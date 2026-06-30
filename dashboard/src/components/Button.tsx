'use client';

import Link from 'next/link';
import { forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

interface ButtonAsButton extends ButtonBaseProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> {
  href?: never;
}

interface ButtonAsLink extends ButtonBaseProps {
  href: string;
  target?: string;
  rel?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:shadow-[0_8px_25px_rgba(59,130,246,0.4)]',
  secondary:
    'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white font-medium',
  ghost:
    'bg-transparent hover:bg-white/5 text-gray-400 hover:text-white font-medium',
  danger:
    'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold shadow-[0_4px_15px_rgba(239,68,68,0.3)] hover:shadow-[0_8px_25px_rgba(239,68,68,0.4)]',
  success:
    'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_25px_rgba(16,185,129,0.4)]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 rounded-lg text-xs',
  md: 'px-5 py-2.5 rounded-xl text-sm',
  lg: 'px-8 py-3.5 rounded-2xl text-base',
};

function getButtonClasses({
  variant = 'primary',
  size = 'md',
  loading,
  className = '',
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
}) {
  return [
    'inline-flex items-center justify-center gap-2',
    'transition-all duration-200',
    'hover:-translate-y-0.5 active:scale-[0.97]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100',
    'relative overflow-hidden',
    variantStyles[variant],
    sizeStyles[size],
    loading && 'cursor-wait',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function ShimmerOverlay() {
  return (
    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
  );
}

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (props, ref) => {
    if ('href' in props && props.href) {
      const {
        variant,
        size,
        loading,
        icon,
        className,
        children,
        href,
        disabled,
        ...rest
      } = props;

      const classes = getButtonClasses({
        variant,
        size,
        className,
      });

      return (
        <Link
          href={disabled ? '#' : href}
          className={`${classes} group`}
          {...(rest as Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className'>)}
          ref={ref as React.Ref<HTMLAnchorElement>}
          onClick={disabled ? (e: React.MouseEvent<HTMLAnchorElement>) => e.preventDefault() : undefined}
        >
          {loading && <LoadingSpinner />}
          {!loading && icon}
          {children}
          <ShimmerOverlay />
        </Link>
      );
    }

    const {
      variant,
      size,
      loading,
      icon,
      className,
      children,
      disabled,
      type = 'button',
      ...rest
    } = props as ButtonAsButton;

    const classes = getButtonClasses({
      variant,
      size,
      loading,
      className,
    });

    return (
      <button
        type={type}
        disabled={disabled || loading}
        className={`${classes} group`}
        {...rest}
        ref={ref as React.Ref<HTMLButtonElement>}
      >
        {loading && <LoadingSpinner />}
        {!loading && icon}
        {children}
        <ShimmerOverlay />
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export type { ButtonVariant, ButtonSize, ButtonProps };
