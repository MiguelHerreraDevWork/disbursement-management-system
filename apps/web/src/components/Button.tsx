import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "../lib/cx";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "dangerSolid" | "ghost";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

// Exposed so a react-router <Link> can be given button styling without
// being turned into a <button> — a navigation target must stay an anchor
// so it keeps its link role, href, and middle-click/open-in-new-tab
// behaviour.
export function buttonClassName({ variant = "primary", size = "md", fullWidth, className }: ButtonStyleOptions = {}) {
  return cx(styles.button, styles[variant], styles[size], fullWidth && styles.fullWidth, className);
}

// A plain styled <button> — deliberately no built-in spinner/label-swap
// behavior. Callers already swap their own button text for pending states
// (e.g. "Approve" -> "Approving...") and that text is what several tests
// assert on, so this component only ever changes appearance, never content.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...rest}
    />
  );
});
