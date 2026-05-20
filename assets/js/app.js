(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function formatMoney(value) {
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  ready(function () {
    document.body.classList.add('is-ready');

    initNavToggle();
    initAlertDismiss();
    initPasswordToggles();
    initDoubleSubmitGuard();
    initAmountShortcuts();
    initTableSearch();
    initKpiCounters();
    initConfirmForms();
  });

  function initNavToggle() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var sidebar = document.getElementById('app-sidebar');
    if (!toggle || !sidebar) {
      return;
    }

    var sidebarCard = sidebar.closest('.card');

    function setOpen(open) {
      sidebar.classList.toggle('is-open', open);
      if (sidebarCard) {
        sidebarCard.classList.toggle('is-open', open);
      }
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('nav-open', open);
    }

    toggle.addEventListener('click', function () {
      setOpen(!sidebar.classList.contains('is-open'));
    });

    document.addEventListener('click', function (event) {
      if (!sidebar.classList.contains('is-open')) {
        return;
      }
      if (sidebar.contains(event.target) || toggle.contains(event.target)) {
        return;
      }
      setOpen(false);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 980) {
        setOpen(false);
      }
    });

    sidebar.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth <= 980) {
          setOpen(false);
        }
      });
    });
  }

  function initAlertDismiss() {
    document.querySelectorAll('.alert').forEach(function (alert) {
      if (alert.querySelector('[data-alert-dismiss]')) {
        return;
      }

      var close = document.createElement('button');
      close.type = 'button';
      close.className = 'alert__close';
      close.setAttribute('data-alert-dismiss', '');
      close.setAttribute('aria-label', 'Dismiss message');
      close.textContent = '\u00d7';
      alert.classList.add('alert--dismissible');
      alert.appendChild(close);

      function dismiss() {
        alert.classList.add('alert--hide');
        window.setTimeout(function () {
          alert.remove();
        }, 280);
      }

      close.addEventListener('click', dismiss);

      if (alert.classList.contains('ok')) {
        window.setTimeout(dismiss, 7000);
      }
    });
  }

  function initPasswordToggles() {
    document.querySelectorAll('[data-password-toggle]').forEach(function (button) {
      var targetId = button.getAttribute('aria-controls');
      var input = targetId ? document.getElementById(targetId) : null;
      if (!input) {
        return;
      }

      button.addEventListener('click', function () {
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        button.setAttribute('aria-pressed', show ? 'true' : 'false');
        button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        var label = button.querySelector('span');
        if (label) {
          label.textContent = show ? 'Hide' : 'Show';
        } else {
          button.textContent = show ? 'Hide' : 'Show';
        }
      });
    });
  }

  function initDoubleSubmitGuard() {
    document.querySelectorAll('form[data-prevent-double-submit]').forEach(function (form) {
      form.addEventListener('submit', function () {
        var submit = form.querySelector('button[type="submit"]');
        if (!submit || submit.disabled) {
          return;
        }

        var label = submit.getAttribute('data-submit-label') || submit.textContent.trim() || 'Submit';
        submit.disabled = true;
        submit.textContent = 'Signing in...';
        submit.setAttribute('aria-label', label + ', please wait');
      });
    });
  }

  function initAmountShortcuts() {
    document.querySelectorAll('[data-amount-shortcuts]').forEach(function (wrap) {
      var input = wrap.querySelector('input[type="number"]');
      if (!input) {
        return;
      }

      wrap.querySelectorAll('[data-amount]').forEach(function (chip) {
        chip.addEventListener('click', function () {
          input.value = chip.getAttribute('data-amount') || '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.focus();
        });
      });
    });
  }

  function initTableSearch() {
    document.querySelectorAll('[data-table-search]').forEach(function (input) {
      var tableId = input.getAttribute('data-table-search');
      var table = tableId ? document.getElementById(tableId) : null;
      if (!table) {
        return;
      }

      var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));

      input.addEventListener('input', function () {
        var query = input.value.trim().toLowerCase();
        rows.forEach(function (row) {
          row.hidden = query !== '' && row.textContent.toLowerCase().indexOf(query) === -1;
        });
      });
    });
  }

  function initKpiCounters() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    var values = document.querySelectorAll('.kpi .value[data-count]');
    if (!values.length || !('IntersectionObserver' in window)) {
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }

        var el = entry.target;
        var target = Number.parseFloat(el.getAttribute('data-count') || '0');
        var prefix = el.getAttribute('data-prefix') || '';
        var suffix = el.getAttribute('data-suffix') || '';
        var decimals = Number.parseInt(el.getAttribute('data-decimals') || '0', 10);
        var start = 0;
        var startTime = null;
        var duration = 700;

        function tick(timestamp) {
          if (!startTime) {
            startTime = timestamp;
          }
          var progress = Math.min((timestamp - startTime) / duration, 1);
          var current = start + (target - start) * progress;
          el.textContent = prefix + (decimals > 0 ? formatMoney(current) : Math.round(current).toLocaleString()) + suffix;
          if (progress < 1) {
            window.requestAnimationFrame(tick);
          }
        }

        window.requestAnimationFrame(tick);
        obs.unobserve(el);
      });
    }, { threshold: 0.35 });

    values.forEach(function (value) {
      observer.observe(value);
    });
  }

  function initConfirmForms() {
    document.querySelectorAll('form[data-confirm]').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        var message = form.getAttribute('data-confirm') || 'Are you sure?';
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      });
    });
  }
}());
