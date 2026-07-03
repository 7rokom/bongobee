import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/dataLayer";
import { isInternalUser } from "@/lib/is-internal-user";

/**
 * Tracks page views on every route change via dataLayer.
 * Skips admin and reseller routes to avoid counting internal page views.
 */
const DataLayerPageTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // Skip tracking for admin and reseller panels
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/reseller')) return;
    // Also skip when an admin/employee/reseller is logged in — even on public pages
    if (isInternalUser()) return;
    trackPageView(document.title, location.pathname);
  }, [location.pathname]);

  return null;
};

export default DataLayerPageTracker;
