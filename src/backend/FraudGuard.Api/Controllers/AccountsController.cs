using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FraudGuard.Api.DTOs.Accounts;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.Services;

namespace FraudGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AccountsController : ControllerBase
    {
        private readonly IAccountService _accountService;

        public AccountsController(IAccountService accountService)
        {
            _accountService = accountService;
        }

        [HttpGet]
        [ProducesResponseType(typeof(ApiResponse<List<AccountDto>>), 200)]
        public async Task<IActionResult> GetAccounts()
        {
            var result = await _accountService.GetAccountsAsync();
            return Ok(ApiResponse<List<AccountDto>>.Ok(result));
        }

        [HttpGet("{id:guid}")]
        [ProducesResponseType(typeof(ApiResponse<AccountDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        public async Task<IActionResult> GetAccountById(Guid id)
        {
            var result = await _accountService.GetAccountByIdAsync(id);
            if (result == null)
            {
                return NotFound(ApiResponse<object>.Fail($"Account with ID '{id}' was not found."));
            }

            return Ok(ApiResponse<AccountDto>.Ok(result));
        }

        [HttpGet("customer/{customerId:guid}")]
        [ProducesResponseType(typeof(ApiResponse<List<AccountDto>>), 200)]
        public async Task<IActionResult> GetAccountsByCustomerId(Guid customerId)
        {
            var result = await _accountService.GetAccountsByCustomerIdAsync(customerId);
            return Ok(ApiResponse<List<AccountDto>>.Ok(result));
        }
    }
}
