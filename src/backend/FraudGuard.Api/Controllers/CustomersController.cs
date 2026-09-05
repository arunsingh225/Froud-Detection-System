using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FraudGuard.Api.DTOs.Common;
using FraudGuard.Api.DTOs.Customers;
using FraudGuard.Api.DTOs.Transactions;
using FraudGuard.Api.DTOs.FraudAlerts;
using FraudGuard.Api.Services;

namespace FraudGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CustomersController : ControllerBase
    {
        private readonly ICustomerService _customerService;

        public CustomersController(ICustomerService customerService)
        {
            _customerService = customerService;
        }

        [HttpGet]
        [ProducesResponseType(typeof(ApiResponse<PagedResult<CustomerDto>>), 200)]
        public async Task<IActionResult> GetCustomers([FromQuery] string? search, [FromQuery] string? riskTier, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _customerService.GetCustomersAsync(search, riskTier, page, pageSize);
            return Ok(ApiResponse<PagedResult<CustomerDto>>.Ok(result));
        }

        [HttpGet("{id:guid}")]
        [ProducesResponseType(typeof(ApiResponse<CustomerDetailDto>), 200)]
        [ProducesResponseType(typeof(ApiResponse<object>), 404)]
        public async Task<IActionResult> GetCustomerById(Guid id)
        {
            var result = await _customerService.GetCustomerByIdAsync(id);
            if (result == null)
            {
                return NotFound(ApiResponse<object>.Fail($"Customer with ID '{id}' was not found."));
            }

            return Ok(ApiResponse<CustomerDetailDto>.Ok(result));
        }

        [HttpGet("{id:guid}/transactions")]
        [ProducesResponseType(typeof(ApiResponse<List<TransactionDto>>), 200)]
        public async Task<IActionResult> GetCustomerTransactions(Guid id)
        {
            var result = await _customerService.GetCustomerTransactionsAsync(id);
            return Ok(ApiResponse<List<TransactionDto>>.Ok(result));
        }

        [HttpGet("{id:guid}/alerts")]
        [ProducesResponseType(typeof(ApiResponse<List<FraudAlertDto>>), 200)]
        public async Task<IActionResult> GetCustomerAlerts(Guid id)
        {
            var result = await _customerService.GetCustomerAlertsAsync(id);
            return Ok(ApiResponse<List<FraudAlertDto>>.Ok(result));
        }
    }
}
