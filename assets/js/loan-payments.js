(function () {
  function formatMoney(value) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  document.querySelectorAll('.loan-payment-form').forEach(function (form) {
    var amountInput = form.querySelector('[data-payment-amount]');
    var preview = form.querySelector('[data-payment-preview]');
    var submitButton = form.querySelector('button[type="submit"]');
    var balance = Number.parseFloat(form.dataset.balance || '0');

    if (!amountInput || !preview || !submitButton || !Number.isFinite(balance)) {
      return;
    }

    function refreshPreview() {
      var amount = Number.parseFloat(amountInput.value || '0');
      var hasAmount = Number.isFinite(amount) && amount > 0;
      var remaining = Math.max(balance - (hasAmount ? amount : 0), 0);
      var overLimit = hasAmount && amount > balance;

      preview.textContent = 'Remaining after payment: ' + formatMoney(remaining);
      preview.classList.toggle('form-feedback--bad', overLimit);
      submitButton.disabled = overLimit || !hasAmount;

      if (overLimit) {
        preview.textContent = 'Payment exceeds the remaining balance of ' + formatMoney(balance) + '.';
      }
    }

    amountInput.addEventListener('input', refreshPreview);
    amountInput.addEventListener('change', refreshPreview);
    refreshPreview();
  });
}());
