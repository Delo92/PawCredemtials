import { Link } from "wouter";
import { useConfig } from "@/contexts/ConfigContext";

export function Footer() {
  const { config } = useConfig();
  const currentYear = new Date().getFullYear();

  const quickLinks = config.footerQuickLinks || [
    { label: "Home", url: "/" },
    { label: "Services", url: "/packages" },
    { label: "About Us", url: "/about" },
    { label: "Contact", url: "/contact" }
  ];

  const legalLinks = config.footerLegalLinks || [
    { label: "Privacy Policy", url: "/privacy" },
    { label: "Terms of Service", url: "/terms" }
  ];

  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-8 md:py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
                {config.siteName.charAt(0)}
              </div>
              <span className="font-semibold">{config.siteName}</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              {config.tagline}
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <Link href={link.url} className="text-muted-foreground hover:text-foreground transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm">
              {legalLinks.map((link, index) => (
                <li key={index}>
                  <Link href={link.url} className="text-muted-foreground hover:text-foreground transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {config.contactEmail && (
                <li>
                  <a href={`mailto:${config.contactEmail}`} className="hover:text-foreground transition-colors">
                    {config.contactEmail}
                  </a>
                </li>
              )}
              {config.contactPhone && (
                <li>
                  <a href={`tel:${config.contactPhone}`} className="hover:text-foreground transition-colors">
                    {config.contactPhone}
                  </a>
                </li>
              )}
              {config.address && <li>{config.address}</li>}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {config.footerText || `© ${currentYear} ${config.siteName}. All rights reserved.`}
          </p>
          <p className="text-xs text-muted-foreground">
            Fast, discreet medical documentation
          </p>
        </div>
      </div>
    </footer>
  );
}
