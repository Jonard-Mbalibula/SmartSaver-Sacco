(function () {
  function formatMoney(value) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  document.querySelectorAll('.deposit-payment-form').forEach(function (form) {
    var targetSelect = form.querySelector('[data-payment-target]');
    var loanFields = form.querySelector('[data-loan-payment-fields]');
    var loanSelect = form.querySelector('[data-loan-select]');
    var amountInput = form.querySelector('[data-payment-amount]');
    var preview = form.querySelector('[data-payment-preview]');
    var submitButton = form.querySelector('[data-payment-submit]');

    if (!targetSelect || !amountInput || !preview || !submitButton) {
      return;
    }

    function selectedLoanBalance() {
      if (!loanSelect || !loanSelect.selectedOptions.length) {
        return 0;
      }

      return Number.parseFloat(loanSelect.selectedOptions[0].dataset.balance || '0');
    }

    function refreshForm() {
      var isLoanPayment = targetSelect.value === 'loan';
      var amount = Number.parseFloat(amountInput.value || '0');
      var hasAmount = Number.isFinite(amount) && amount > 0;

      if (loanFields) {
        loanFields.hidden = !isLoanPayment;
      }

      if (!isLoanPayment) {
        amountInput.removeAttribute('max');
        preview.classList.remove('form-feedback--bad');
        preview.textContent = hasAmount
          ? 'Savings balance will increase by ' + formatMoney(amount) + '.'
          : 'Savings balance will increase by the entered amount.';
        submitButton.disabled = !hasAmount;
        return;
      }

      var balance = selectedLoanBalance();
      var remaining = Math.max(balance - (hasAmount ? amount : 0), 0);
      var overLimit = hasAmount && amount > balance;

      amountInput.max = balance.toFixed(2);
      preview.classList.toggle('form-feedback--bad', overLimit);
      preview.textContent = overLimit
        ? 'Payment exceeds the selected loan balance of ' + formatMoney(balance) + '.'
        : 'Loan balance after payment: ' + formatMoney(remaining) + '.';
      submitButton.disabled = overLimit || !hasAmount || balance <= 0;
    }

    targetSelect.addEventListener('change', refreshForm);
    amountInput.addEventListener('input', refreshForm);
    amountInput.addEventListener('change', refreshForm);

    if (loanSelect) {
      loanSelect.addEventListener('change', refreshForm);
    }

    refreshForm();
  });
}());
