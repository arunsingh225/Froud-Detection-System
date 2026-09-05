using Microsoft.EntityFrameworkCore;
using FraudGuard.Api.Models;

namespace FraudGuard.Api.Data
{
    public class FraudGuardDbContext : DbContext
    {
        public FraudGuardDbContext(DbContextOptions<FraudGuardDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users => Set<User>();
        public DbSet<Customer> Customers => Set<Customer>();
        public DbSet<Account> Accounts => Set<Account>();
        public DbSet<Merchant> Merchants => Set<Merchant>();
        public DbSet<Device> Devices => Set<Device>();
        public DbSet<CustomerDevice> CustomerDevices => Set<CustomerDevice>();
        public DbSet<Transaction> Transactions => Set<Transaction>();
        public DbSet<FraudPrediction> FraudPredictions => Set<FraudPrediction>();
        public DbSet<FraudAlert> FraudAlerts => Set<FraudAlert>();
        public DbSet<Investigation> Investigations => Set<Investigation>();
        public DbSet<InvestigationEvidence> InvestigationEvidence => Set<InvestigationEvidence>();
        public DbSet<InvestigationTimeline> InvestigationTimeline => Set<InvestigationTimeline>();
        public DbSet<Report> Reports => Set<Report>();
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Primary Keys
            modelBuilder.Entity<User>().HasKey(e => e.UserId);
            modelBuilder.Entity<Customer>().HasKey(e => e.CustomerId);
            modelBuilder.Entity<Account>().HasKey(e => e.AccountId);
            modelBuilder.Entity<Merchant>().HasKey(e => e.MerchantId);
            modelBuilder.Entity<Device>().HasKey(e => e.DeviceId);
            modelBuilder.Entity<CustomerDevice>().HasKey(cd => new { cd.CustomerId, cd.DeviceId });
            modelBuilder.Entity<Transaction>().HasKey(e => e.TransactionId);
            modelBuilder.Entity<FraudPrediction>().HasKey(e => e.PredictionId);
            modelBuilder.Entity<FraudAlert>().HasKey(e => e.AlertId);
            modelBuilder.Entity<Investigation>().HasKey(e => e.InvestigationId);
            modelBuilder.Entity<InvestigationEvidence>().HasKey(e => e.EvidenceId);
            modelBuilder.Entity<InvestigationTimeline>().HasKey(e => e.TimelineId);
            modelBuilder.Entity<Report>().HasKey(e => e.ReportId);
            modelBuilder.Entity<AuditLog>().HasKey(e => e.AuditLogId);

            // Table Mappings
            modelBuilder.Entity<User>().ToTable("Users");
            modelBuilder.Entity<Customer>().ToTable("Customers");
            modelBuilder.Entity<Account>().ToTable("Accounts");
            modelBuilder.Entity<Merchant>().ToTable("Merchants");
            modelBuilder.Entity<Device>().ToTable("Devices");
            modelBuilder.Entity<CustomerDevice>().ToTable("CustomerDevices");
            modelBuilder.Entity<Transaction>().ToTable("Transactions");
            modelBuilder.Entity<FraudPrediction>().ToTable("FraudPredictions");
            modelBuilder.Entity<FraudAlert>().ToTable("FraudAlerts");
            modelBuilder.Entity<Investigation>().ToTable("Investigations");
            modelBuilder.Entity<InvestigationEvidence>().ToTable("InvestigationEvidence");
            modelBuilder.Entity<InvestigationTimeline>().ToTable("InvestigationTimeline");
            modelBuilder.Entity<Report>().ToTable("Reports");
            modelBuilder.Entity<AuditLog>().ToTable("AuditLogs");

            // Precision for decimals
            modelBuilder.Entity<Customer>(entity =>
            {
                entity.Property(e => e.BaselineAvgAmount).HasPrecision(18, 2);
                entity.Property(e => e.Rolling30dVolume).HasPrecision(18, 2);
                entity.Property(e => e.RiskScore).HasPrecision(5, 2);
            });

            modelBuilder.Entity<Account>(entity =>
            {
                entity.Property(e => e.CurrentBalance).HasPrecision(18, 2);
                entity.Property(e => e.DailyLimit).HasPrecision(18, 2);
            });

            modelBuilder.Entity<Transaction>(entity =>
            {
                entity.Property(e => e.AmountInr).HasPrecision(18, 2);
                entity.Property(e => e.AmountUsd).HasPrecision(18, 2);
                entity.Property(e => e.Latitude).HasPrecision(9, 6);
                entity.Property(e => e.Longitude).HasPrecision(9, 6);
                entity.Property(e => e.DistanceFromTypicalKm).HasPrecision(10, 2);
            });

            modelBuilder.Entity<FraudPrediction>(entity =>
            {
                entity.Property(e => e.FraudProbability).HasPrecision(5, 2);
                entity.Property(e => e.VelocityRatio).HasPrecision(8, 2);
            });

            modelBuilder.Entity<InvestigationEvidence>(entity =>
            {
                entity.Property(e => e.Confidence).HasPrecision(5, 2);
            });

            // Composite Key for CustomerDevices
            modelBuilder.Entity<CustomerDevice>()
                .HasKey(cd => new { cd.CustomerId, cd.DeviceId });

            // 1:1 Transaction -> FraudPrediction
            modelBuilder.Entity<Transaction>()
                .HasOne(t => t.FraudPrediction)
                .WithOne(fp => fp.Transaction)
                .HasForeignKey<FraudPrediction>(fp => fp.TransactionId)
                .OnDelete(DeleteBehavior.Cascade);

            // Relationships
            modelBuilder.Entity<Transaction>()
                .HasOne(t => t.Customer)
                .WithMany(c => c.Transactions)
                .HasForeignKey(t => t.CustomerId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<Transaction>()
                .HasOne(t => t.Account)
                .WithMany(a => a.Transactions)
                .HasForeignKey(t => t.AccountId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<FraudAlert>()
                .HasOne(fa => fa.Transaction)
                .WithMany(t => t.FraudAlerts)
                .HasForeignKey(fa => fa.TransactionId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<FraudAlert>()
                .HasOne(fa => fa.Customer)
                .WithMany(c => c.FraudAlerts)
                .HasForeignKey(fa => fa.CustomerId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<Investigation>()
                .HasOne(i => i.Transaction)
                .WithMany(t => t.Investigations)
                .HasForeignKey(i => i.TransactionId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<Investigation>()
                .HasOne(i => i.Customer)
                .WithMany(c => c.Investigations)
                .HasForeignKey(i => i.CustomerId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<Report>()
                .HasOne(r => r.Customer)
                .WithMany(c => c.Reports)
                .HasForeignKey(r => r.CustomerId)
                .OnDelete(DeleteBehavior.NoAction);

            // ===== Performance Indexes =====
            modelBuilder.Entity<Transaction>()
                .HasIndex(t => t.TransactionCode);
            modelBuilder.Entity<Transaction>()
                .HasIndex(t => t.TransactionTimestamp);
            modelBuilder.Entity<Transaction>()
                .HasIndex(t => t.Status);
            modelBuilder.Entity<Transaction>()
                .HasIndex(t => t.CustomerId);

            modelBuilder.Entity<Customer>()
                .HasIndex(c => c.CustomerCode);
            modelBuilder.Entity<Customer>()
                .HasIndex(c => c.Email);
            modelBuilder.Entity<Customer>()
                .HasIndex(c => c.RiskTier);

            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            modelBuilder.Entity<FraudAlert>()
                .HasIndex(fa => fa.Status);
            modelBuilder.Entity<FraudAlert>()
                .HasIndex(fa => fa.Severity);
            modelBuilder.Entity<FraudAlert>()
                .HasIndex(fa => fa.CreatedAt);

            modelBuilder.Entity<FraudPrediction>()
                .HasIndex(fp => fp.RiskTier);

            modelBuilder.Entity<Investigation>()
                .HasIndex(i => i.Status);
            modelBuilder.Entity<Investigation>()
                .HasIndex(i => i.CreatedAt);

            modelBuilder.Entity<AuditLog>()
                .HasIndex(a => a.CreatedAt);
            modelBuilder.Entity<AuditLog>()
                .HasIndex(a => a.Action);

            modelBuilder.Entity<Report>()
                .HasIndex(r => r.Category);
        }
    }
}
