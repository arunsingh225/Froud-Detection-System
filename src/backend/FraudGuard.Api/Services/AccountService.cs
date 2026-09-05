using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs.Accounts;

namespace FraudGuard.Api.Services
{
    public interface IAccountService
    {
        Task<List<AccountDto>> GetAccountsAsync();
        Task<AccountDto?> GetAccountByIdAsync(Guid id);
        Task<List<AccountDto>> GetAccountsByCustomerIdAsync(Guid customerId);
    }

    public class AccountService : IAccountService
    {
        private readonly FraudGuardDbContext _db;

        public AccountService(FraudGuardDbContext db)
        {
            _db = db;
        }

        public async Task<List<AccountDto>> GetAccountsAsync()
        {
            return await _db.Accounts
                .Include(a => a.Customer)
                .AsNoTracking()
                .Select(a => new AccountDto
                {
                    AccountId = a.AccountId,
                    AccountCode = a.AccountCode,
                    CustomerId = a.CustomerId,
                    CustomerName = a.Customer != null ? a.Customer.FullName : "",
                    AccountNumber = a.AccountNumber,
                    AccountType = a.AccountType,
                    Currency = a.Currency,
                    CurrentBalance = a.CurrentBalance,
                    DailyLimit = a.DailyLimit,
                    Status = a.Status,
                    OpenedDate = a.OpenedDate
                })
                .ToListAsync();
        }

        public async Task<AccountDto?> GetAccountByIdAsync(Guid id)
        {
            var a = await _db.Accounts
                .Include(x => x.Customer)
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.AccountId == id);

            if (a == null) return null;

            return new AccountDto
            {
                AccountId = a.AccountId,
                AccountCode = a.AccountCode,
                CustomerId = a.CustomerId,
                CustomerName = a.Customer != null ? a.Customer.FullName : "",
                AccountNumber = a.AccountNumber,
                AccountType = a.AccountType,
                Currency = a.Currency,
                CurrentBalance = a.CurrentBalance,
                DailyLimit = a.DailyLimit,
                Status = a.Status,
                OpenedDate = a.OpenedDate
            };
        }

        public async Task<List<AccountDto>> GetAccountsByCustomerIdAsync(Guid customerId)
        {
            return await _db.Accounts
                .Include(a => a.Customer)
                .Where(a => a.CustomerId == customerId)
                .AsNoTracking()
                .Select(a => new AccountDto
                {
                    AccountId = a.AccountId,
                    AccountCode = a.AccountCode,
                    CustomerId = a.CustomerId,
                    CustomerName = a.Customer != null ? a.Customer.FullName : "",
                    AccountNumber = a.AccountNumber,
                    AccountType = a.AccountType,
                    Currency = a.Currency,
                    CurrentBalance = a.CurrentBalance,
                    DailyLimit = a.DailyLimit,
                    Status = a.Status,
                    OpenedDate = a.OpenedDate
                })
                .ToListAsync();
        }
    }
}
