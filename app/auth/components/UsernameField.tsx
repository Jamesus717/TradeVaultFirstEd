'use client';

import { usernameValidationMessage } from '../utils';

export default function UsernameField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const validationMessage = usernameValidationMessage(value);

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Username (e.g. ash_ketchum)"
        className="w-full rounded-xl border border-white/10 bg-stone-950 px-4 py-3 text-sm text-white outline-none"
      />
      {validationMessage ? (
        <p className="mt-1 pl-2 text-xs text-rose-400">{validationMessage}</p>
      ) : null}
    </div>
  );
}
