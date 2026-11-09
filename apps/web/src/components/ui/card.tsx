import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  title?: string;
  description?: string;
  action?: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
};

export function Card({
  children,
  title,
  description,
  action,
  padding = "md",
  className = "",
  ...props
}: CardProps) {
  return (
    <section className={["rc-card", `rc-card--${padding}`, className].filter(Boolean).join(" ")} {...props}>
      {title || description || action ? (
        <header className="rc-card__header">
          <div>
            {title ? <h2 className="rc-card__title">{title}</h2> : null}
            {description ? <p className="rc-card__description">{description}</p> : null}
          </div>
          {action ? <div className="rc-card__action">{action}</div> : null}
        </header>
      ) : null}
      <div className="rc-card__content">{children}</div>
    </section>
  );
}
