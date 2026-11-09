import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  leadingIcon,
  trailingIcon,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={["rc-button", `rc-button--${variant}`, `rc-button--${size}`, className]
        .filter(Boolean)
        .join(" ")}
      type={type}
      {...props}
    >
      {leadingIcon ? <span className="rc-button__icon">{leadingIcon}</span> : null}
      <span>{children}</span>
      {trailingIcon ? <span className="rc-button__icon">{trailingIcon}</span> : null}
    </button>
  );
}
