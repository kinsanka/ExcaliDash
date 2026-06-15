import React, { useMemo, useState } from 'react';
import { translate } from '../i18n';
import { getOrCreateBrowserFingerprint, getFingerprintInitials } from '../utils/identity';

const fnv1a = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const toHsl = (n: number) => {
  const hue = n % 360;
  const sat = 55 + (n % 20);
  const light = 42 + (n % 12);
  return `hsl(${hue} ${sat}% ${light}%)`;
};

export const FingerprintAvatar: React.FC<{
  size?: number;
  seed?: string;
  title?: string;
  className?: string;
}> = ({ size = 32, seed, title = translate("common.browserFingerprintAvatar"), className }) => {
  const [deviceId] = useState(() => getOrCreateBrowserFingerprint());
  const effectiveSeed = seed || deviceId;

  const initials = useMemo(() => getFingerprintInitials(effectiveSeed), [effectiveSeed]);
  const background = useMemo(() => toHsl(fnv1a(effectiveSeed)), [effectiveSeed]);

  return (
    <div
      title={title}
      aria-label={title}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background,
      }}
    >
      <div className="w-full h-full flex items-center justify-center font-bold text-white text-xs select-none">
        {initials}
      </div>
    </div>
  );
};
