/**
 * Identity badge. Authentication is removed from this build, so there is no
 * sign-out and no menu — every action is attributed to the seeded system user.
 */
export function UserMenu() {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-fg"
      >
        S
      </span>
      <span className="hidden text-sm text-muted sm:inline">System</span>
    </div>
  );
}
