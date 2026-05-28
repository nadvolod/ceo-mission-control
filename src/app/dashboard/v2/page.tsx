import { permanentRedirect } from 'next/navigation';

// /dashboard/v2 was the staging route while the new console lived alongside
// the legacy one. The new console is now the default at /dashboard, but
// we keep this path as a permanent redirect so old bookmarks, shared
// links, and any external integrations that point at /dashboard/v2 still
// resolve. Remove this file when we're confident no external links
// reference it (probably ~one release cycle from now).
export default function DashboardV2Redirect() {
  permanentRedirect('/dashboard');
}
