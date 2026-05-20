<?php
declare(strict_types=1);

if (!function_exists('h')) {
    function h(?string $value): string
    {
        return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('brand_image_url')) {
    function brand_image_url(): string
    {
        return '/DSLT/includes/image.png';
    }
}

if (!function_exists('brand_image_tag')) {
    function brand_image_tag(string $alt = 'SmartSaver', string $class = '', int $width = 48, int $height = 48): string
    {
        $classAttr = $class !== '' ? ' class="' . h($class) . '"' : '';

        return '<img src="' . h(brand_image_url()) . '" alt="' . h($alt) . '" width="' . $width . '" height="' . $height . '" decoding="async"' . $classAttr . '>';
    }
}

if (!function_exists('money')) {
    function money(float $value): string
    {
        return number_format($value, 2);
    }
}

if (!function_exists('format_datetime')) {
    function format_datetime(?string $value): string
    {
        if (!$value) {
            return '-';
        }

        try {
            return (new DateTime($value))->format('d M Y, h:i A');
        } catch (Throwable $e) {
            return $value;
        }
    }
}

if (!function_exists('format_date')) {
    function format_date(?string $value): string
    {
        if (!$value) {
            return '-';
        }

        try {
            return (new DateTime($value))->format('d M Y');
        } catch (Throwable $e) {
            return $value;
        }
    }
}

if (!function_exists('loan_status_class')) {
    function loan_status_class(string $status): string
    {
        return match (strtolower($status)) {
            'approved', 'closed' => 'status-good',
            'pending' => 'status-warn',
            'rejected' => 'status-bad',
            default => 'status-neutral',
        };
    }
}

if (!function_exists('transaction_class')) {
    function transaction_class(string $type, int $isReversal = 0): string
    {
        if ($isReversal === 1) {
            return 'status-neutral';
        }

        return $type === 'deposit' ? 'status-good' : 'status-bad';
    }
}
