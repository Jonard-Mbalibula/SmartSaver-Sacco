<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Security Helper Functions
|--------------------------------------------------------------------------
| This file should be included with:
|     require_once __DIR__ . '/security.php';
|--------------------------------------------------------------------------
*/

if (!function_exists('secure_session_start')) {
    /**
     * Start a hardened session.
     * Must be called before any output is sent.
     */
    function secure_session_start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        @ini_set('session.use_strict_mode', '1');
        @ini_set('session.use_only_cookies', '1');
        @ini_set('session.use_trans_sid', '0');

        $isHttps = (
            !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'
        ) || (
            isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443'
        );

        if (PHP_VERSION_ID >= 70300) {
            session_set_cookie_params([
                'lifetime' => 0,
                'path'     => '/',
                'domain'   => '',
                'secure'   => $isHttps,
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
        } else {
            session_set_cookie_params(
                0,
                '/; samesite=Lax',
                '',
                $isHttps,
                true
            );
        }

        session_start();
    }
}

if (!function_exists('send_security_headers')) {
    /**
     * Send baseline security headers.
     * Must be called before output is sent.
     */
    function send_security_headers(): void
    {
        if (headers_sent()) {
            return;
        }

        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
        $nonce = csp_nonce();
        header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-$nonce' https://cdn.jsdelivr.net; base-uri 'self'; frame-ancestors 'none'");
    }
}

if (!function_exists('csp_nonce')) {
    /**
     * Generate a per-request CSP nonce for inline scripts.
     */
    function csp_nonce(): string
    {
        static $nonce = null;

        if ($nonce === null) {
            $nonce = base64_encode(random_bytes(16));
        }

        return $nonce;
    }
}

if (!function_exists('csrf_init')) {
    /**
     * Create a CSRF token if it does not exist.
     */
    function csrf_init(): void
    {
        secure_session_start();

        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
    }
}

if (!function_exists('csrf_field')) {
    /**
     * Return a hidden input field containing the CSRF token.
     */
    function csrf_field(): string
    {
        csrf_init();

        return '<input type="hidden" name="csrf_token" value="' .
            htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8') .
            '">';
    }
}

if (!function_exists('csrf_verify')) {
    /**
     * Verify CSRF token on POST requests.
     */
    function csrf_verify(): void
    {
        csrf_init();

        $token = $_POST['csrf_token'] ?? '';

        if (!is_string($token) || !hash_equals($_SESSION['csrf_token'], $token)) {
            http_response_code(403);
            exit('Security error: invalid CSRF token.');
        }
    }
}

if (!function_exists('flash_set')) {
    /**
     * Store a flash message for the next request.
     */
    function flash_set(string $key, string $message, string $type = 'ok'): void
    {
        secure_session_start();

        if (!isset($_SESSION['flash']) || !is_array($_SESSION['flash'])) {
            $_SESSION['flash'] = [];
        }

        $_SESSION['flash'][$key] = [
            'message' => $message,
            'type' => $type,
        ];
    }
}

if (!function_exists('flash_get')) {
    /**
     * Read and clear a flash message.
     *
     * @return array{message:string,type:string}|null
     */
    function flash_get(string $key): ?array
    {
        secure_session_start();

        if (
            !isset($_SESSION['flash'][$key]) ||
            !is_array($_SESSION['flash'][$key])
        ) {
            return null;
        }

        $flash = $_SESSION['flash'][$key];
        unset($_SESSION['flash'][$key]);

        return [
            'message' => (string)($flash['message'] ?? ''),
            'type' => (string)($flash['type'] ?? 'ok'),
        ];
    }
}

if (!function_exists('form_token_field')) {
    /**
     * Generate a one-time form token that can be consumed once.
     */
    function form_token_field(string $form): string
    {
        secure_session_start();

        if (!isset($_SESSION['form_tokens']) || !is_array($_SESSION['form_tokens'])) {
            $_SESSION['form_tokens'] = [];
        }

        if (!isset($_SESSION['form_tokens'][$form]) || !is_array($_SESSION['form_tokens'][$form])) {
            $_SESSION['form_tokens'][$form] = [];
        }

        $cutoff = time() - 3600;
        foreach ($_SESSION['form_tokens'][$form] as $token => $createdAt) {
            if (!is_int($createdAt) || $createdAt < $cutoff) {
                unset($_SESSION['form_tokens'][$form][$token]);
            }
        }

        while (count($_SESSION['form_tokens'][$form]) >= 20) {
            array_shift($_SESSION['form_tokens'][$form]);
        }

        $token = bin2hex(random_bytes(32));
        $_SESSION['form_tokens'][$form][$token] = time();

        return '<input type="hidden" name="_form_token" value="' .
            htmlspecialchars($token, ENT_QUOTES, 'UTF-8') .
            '">';
    }
}

if (!function_exists('form_token_verify')) {
    /**
     * Verify and consume a one-time form token.
     */
    function form_token_verify(string $form): bool
    {
        secure_session_start();

        $token = $_POST['_form_token'] ?? '';
        if (!is_string($token) || $token === '') {
            return false;
        }

        if (
            !isset($_SESSION['form_tokens'][$form]) ||
            !is_array($_SESSION['form_tokens'][$form]) ||
            !array_key_exists($token, $_SESSION['form_tokens'][$form])
        ) {
            return false;
        }

        unset($_SESSION['form_tokens'][$form][$token]);

        return true;
    }
}
