import { Link } from "react-router-dom";
import { Facebook, Youtube, Twitter, Linkedin, MapPin, Phone, Mail, Pin, User, PhoneCall, ShieldQuestion, HelpCircle, FileText } from "lucide-react";
import { useSiteSettingsStore } from "@/stores/useSiteSettingsStore";
import { useResellerSlug, useResellerRefValue } from "@/contexts/ResellerRefContext";

const iconMap: Record<string, React.ElementType> = {
  User, PhoneCall, ShieldQuestion, HelpCircle, FileText,
};

const Footer = () => {
  const site = useSiteSettingsStore();
  const resellerRef = useResellerSlug();
  const branding = useResellerRefValue()?.branding;

  // When a reseller has custom branding set, override the site defaults.
  const logoUrl      = branding?.logoUrl      || site.logoUrl;
  const address      = branding?.address      || site.address;
  const phone        = branding?.phone        || site.phone;
  const footerCredit = branding?.footerCredit || site.footerCredit;
  const legalPages   = branding?.legalPages   || site.legalPages;
  const facebookUrl  = branding?.facebookUrl  || site.facebookUrl;
  const youtubeUrl   = branding?.youtubeUrl   || site.youtubeUrl;
  const twitterUrl   = branding?.twitterUrl   || site.twitterUrl;
  const linkedinUrl  = site.linkedinUrl;
  const pinterestUrl = site.pinterestUrl;
  const email        = site.email;
  const bio          = branding?.bio;

  return (
    <footer>
      <div style={{ background: "var(--gradient-primary)" }}>
        <div className="container-box py-12">
          <div className="grid grid-cols-2 lg:grid-cols-[32%_18%_18%_32%] gap-6">
            {/* Col 1 - About (40%) */}
            <div className="col-span-2 lg:col-span-1">
              <img src={logoUrl} alt="BongoBee" className="h-16 w-auto object-contain mb-3" />
              <p className="text-[15px] text-white leading-relaxed">
                {bio || 'BongoBee is a Bangladeshi online shopping platform where you can easily find authentic products including and more at affordable prices. We prioritize fast delivery, easy ordering and customer satisfaction.'}
              </p>
            </div>

            {/* Col 2 - Legal (20%) */}
            <div>
              <h3 className="font-semibold text-[17px] text-white mb-3">Legal Pages</h3>
              <ul className="space-y-1.5 text-[15px] text-white">
                {(legalPages || []).map((page, i) => {
                  const IconComp = iconMap[page.icon] || FileText;
                  const isExternal = page.url.startsWith('http');
                  const resolvedUrl = !isExternal && resellerRef
                    ? `/r/${resellerRef}/page${page.url.startsWith('/') ? page.url : `/${page.url}`}`
                    : page.url;
                  return (
                    <li key={i}>
                      {isExternal ? (
                        <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                          <IconComp className="h-4 w-4 flex-shrink-0" /> {page.label}
                        </a>
                      ) : (
                        <Link to={resolvedUrl} className="flex items-center gap-2 hover:text-white transition-colors">
                          <IconComp className="h-4 w-4 flex-shrink-0" /> {page.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Col 3 - Follow Us (20%) */}
            <div>
              <h3 className="font-semibold text-[17px] text-white mb-3">Follow Us</h3>
              <ul className="space-y-1.5 text-[15px] text-white">
                {facebookUrl && (
                  <li>
                    <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                      <Facebook className="h-4 w-4" /> Facebook
                    </a>
                  </li>
                )}
                {youtubeUrl && (
                  <li>
                    <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                      <Youtube className="h-4 w-4" /> Youtube
                    </a>
                  </li>
                )}
                {pinterestUrl && (
                  <li>
                    <a href={pinterestUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                      <Pin className="h-4 w-4" /> Pinterest
                    </a>
                  </li>
                )}
                {twitterUrl && (
                  <li>
                    <a href={twitterUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                      <Twitter className="h-4 w-4" /> Twitter
                    </a>
                  </li>
                )}
                {linkedinUrl && (
                  <li>
                    <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                      <Linkedin className="h-4 w-4" /> LinkedIn
                    </a>
                  </li>
                )}
              </ul>
            </div>

            {/* Col 4 - Contact (20%) */}
            <div className="col-span-2 lg:col-span-1 min-w-0">
              <ul className="space-y-2 text-[15px] text-white">
                <li className="flex items-start gap-2 min-w-0">
                  <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span className="break-words min-w-0">{address}</span>
                </li>
                <li className="flex items-start gap-2 min-w-0">
                  <Phone className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span className="break-words min-w-0">Call: {phone}</span>
                </li>
                <li className="flex items-start gap-2 min-w-0">
                  <Mail className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span className="break-all min-w-0">Email: {email}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-white/20" style={{ background: "var(--gradient-primary)" }}>
        <div className="container-box py-4 text-center text-[15px] text-white">
          {footerCredit || '© 2026 BongoBee All Rights Reserved.'}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
