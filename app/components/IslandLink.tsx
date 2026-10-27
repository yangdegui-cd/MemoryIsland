"use client";

import {forwardRef, type ComponentPropsWithoutRef} from 'react';
import {useRouter} from 'next/navigation';

type Props = Omit<ComponentPropsWithoutRef<'a'>, 'href'> & {
  href: string;
  prefetch?: boolean;
};

// Use the statically imported router: Vinext's production Link dynamically
// imports an internal navigation export that is renamed by the current bundler.
const IslandLink = forwardRef<HTMLAnchorElement, Props>(function IslandLink(
  {href, onClick, prefetch: _prefetch, ...props}, ref,
) {
  const router = useRouter();
  return <a {...props} ref={ref} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
      event.shiftKey || event.altKey || event.currentTarget.hasAttribute('download') ||
      (event.currentTarget.target && event.currentTarget.target !== '_self')) return;
    const target = new URL(href, window.location.href);
    if (target.origin !== window.location.origin) return;
    event.preventDefault();
    router.push(target.pathname + target.search + target.hash);
  }}/>;
});

export default IslandLink;
