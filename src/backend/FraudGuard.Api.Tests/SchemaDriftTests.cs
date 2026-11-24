using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using FraudGuard.Api.Data;
using Xunit;

namespace FraudGuard.Api.Tests
{
    /// <summary>
    /// The database schema is created by hand-written SQL (sql/01 ...), not by EF migrations, so nothing else stops the
    /// EF model and the real tables from drifting apart. This compares them on a real SQL Server (FG_TEST_SQL, same
    /// throwaway database as the other SqlServer tests, with scripts 01, 05 and 06 applied).
    /// </summary>
    public class SchemaDriftTests
    {
        private sealed record DbColumn(bool Nullable, bool HasDefault, bool Computed, bool Identity, int? MaxLength, string Type);

        private static async Task<Dictionary<(string Table, string Column), DbColumn>> LoadColumns(string connectionString)
        {
            const string sql = @"
                SELECT c.TABLE_NAME, c.COLUMN_NAME, c.IS_NULLABLE, c.COLUMN_DEFAULT, c.CHARACTER_MAXIMUM_LENGTH, c.DATA_TYPE,
                       COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsComputed'),
                       COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity')
                FROM INFORMATION_SCHEMA.COLUMNS c
                WHERE c.TABLE_SCHEMA = 'dbo'";
            var result = new Dictionary<(string, string), DbColumn>(new TupleComparer());
            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync();
            await using var cmd = new SqlCommand(sql, conn);
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                result[(r.GetString(0), r.GetString(1))] = new DbColumn(
                    Nullable: r.GetString(2) == "YES",
                    HasDefault: !r.IsDBNull(3),
                    Computed: !r.IsDBNull(6) && Convert.ToInt32(r.GetValue(6)) == 1,
                    Identity: !r.IsDBNull(7) && Convert.ToInt32(r.GetValue(7)) == 1,
                    MaxLength: r.IsDBNull(4) ? null : r.GetInt32(4),   // -1 = MAX
                    Type: r.GetString(5));
            }
            return result;
        }

        private sealed class TupleComparer : IEqualityComparer<(string, string)>
        {
            public bool Equals((string, string) a, (string, string) b) =>
                string.Equals(a.Item1, b.Item1, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(a.Item2, b.Item2, StringComparison.OrdinalIgnoreCase);
            public int GetHashCode((string, string) k) =>
                HashCode.Combine(k.Item1.ToLowerInvariant(), k.Item2.ToLowerInvariant());
        }

        [SqlServerFact]
        public async Task EfModel_AndSqlSchema_Agree()
        {
            var connectionString = Environment.GetEnvironmentVariable("FG_TEST_SQL")!;
            var columns = await LoadColumns(connectionString);
            await using var db = new FraudGuardDbContext(
                new DbContextOptionsBuilder<FraudGuardDbContext>().UseSqlServer(connectionString).Options);

            var problems = new List<string>();
            foreach (var entity in db.Model.GetEntityTypes().Where(e => e.GetTableName() != null))
            {
                var table = entity.GetTableName()!;
                var store = StoreObjectIdentifier.Table(table, entity.GetSchema());
                var mapped = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                if (!columns.Keys.Any(k => string.Equals(k.Table, table, StringComparison.OrdinalIgnoreCase)))
                {
                    problems.Add($"{entity.ClrType.Name}: table dbo.{table} does not exist");
                    continue;
                }

                foreach (var p in entity.GetProperties())
                {
                    var name = p.GetColumnName(store);
                    if (name == null) continue;
                    mapped.Add(name);
                    if (!columns.TryGetValue((table, name), out var col))
                    {
                        problems.Add($"{table}.{name}: mapped by EF ({entity.ClrType.Name}.{p.Name}) but missing in SQL");
                        continue;
                    }
                    if (col.Computed || col.Identity) continue;
                    if (p.IsNullable && !col.Nullable && !col.HasDefault)
                        problems.Add($"{table}.{name}: EF allows null but the column is NOT NULL without a default");
                    if (p.ClrType == typeof(string) && p.GetMaxLength() is int efMax && col.MaxLength is int dbMax && dbMax != -1 && efMax > dbMax)
                        problems.Add($"{table}.{name}: EF MaxLength {efMax} exceeds SQL length {dbMax} (long values would be truncated or rejected)");
                }

                foreach (var ((t, c), col) in columns.Where(k => string.Equals(k.Key.Table, table, StringComparison.OrdinalIgnoreCase)))
                {
                    if (!mapped.Contains(c) && !col.Nullable && !col.HasDefault && !col.Computed && !col.Identity)
                        problems.Add($"{t}.{c}: NOT NULL without default in SQL but not mapped by EF (inserts from the app would fail)");
                }
            }

            Assert.True(problems.Count == 0, "EF model and SQL schema disagree:\n  " + string.Join("\n  ", problems));
        }
    }
}
