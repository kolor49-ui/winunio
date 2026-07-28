type Props = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

export function PhoneInputHu({
  id = "phone-local",
  name = "phone_local",
  value,
  onChange,
  disabled = false,
  autoFocus = false,
}: Props) {
  return (
    <div className="phone-input-hu">
      <span className="phone-input-hu-prefix" aria-hidden="true">
        <span className="phone-input-hu-flag">🇭🇺</span>
        +36
      </span>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="20 531 0087"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label="Magyar mobilszám, +36 után"
      />
    </div>
  );
}
