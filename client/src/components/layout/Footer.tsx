import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/contexts/ConfigContext";
import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";

export function Footer() {
  const { config } = useConfig();
  const currentYear = new Date().getFullYear();

  const quickLinks = config.footerQuickLinks || [
    { label: "Home", url: "/" },
    { label: "About Us", url: "/#about" },
    { label: "Services", url: "/packages" },
    { label: "Privacy Policy", url: "/privacy" },
    { label: "Terms of Service", url: "/terms" },
  ];

  const serviceLinks = [
    { label: "ESA Letters", url: "/packages" },
    { label: "Housing Certification", url: "/packages" },
    { label: "Travel Certificates", url: "/packages" },
    { label: "PSD Letters", url: "/packages" },
  ];

  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Link href="/" className="inline-block" data-testid="link-footer-logo">
              <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'hsl(var(--heading-color))' }}>
                {config.siteName}
              </span>
            </Link>
            <div className="space-y-2 text-sm text-muted-foreground">
              {config.address && (
                <p className="flex items-start gap-2" data-testid="text-footer-address">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                  {config.address}
                </p>
              )}
              {config.contactPhone && (
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0" />
                  <a href={`tel:${config.contactPhone}`} className="hover:text-primary transition-colors" data-testid="link-footer-phone">
                    {config.contactPhone}
                  </a>
                </p>
              )}
              {config.contactEmail && (
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0" />
                  <a href={`mailto:${config.contactEmail}`} className="hover:text-primary transition-colors" data-testid="link-footer-email">
                    {config.contactEmail}
                  </a>
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-base font-semibold pb-3 relative">
              Useful Links
            </h4>
            <ul className="space-y-2.5 text-sm">
              {quickLinks.map((link, index) => (
                <li key={index} className="flex items-center gap-1.5">
                  <span className="text-primary text-xs">&#9656;</span>
                  <Link href={link.url} className="text-muted-foreground hover:text-primary transition-colors" data-testid={`link-footer-quick-${index}`}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-base font-semibold pb-3 relative">
              Our Services
            </h4>
            <ul className="space-y-2.5 text-sm">
              {serviceLinks.map((link, index) => (
                <li key={index} className="flex items-center gap-1.5">
                  <span className="text-primary text-xs">&#9656;</span>
                  <Link href={link.url} className="text-muted-foreground hover:text-primary transition-colors" data-testid={`link-footer-service-${index}`}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-base font-semibold pb-3 relative">
              Get Started
            </h4>
            <p className="text-sm text-muted-foreground">
              Need to register your support animal? Create your account and get started in minutes.
            </p>
            <Button asChild data-testid="button-footer-register">
              <Link href="/register">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground" data-testid="text-footer-copyright">
            {config.footerText || `\u00A9 ${currentYear} ${config.siteName}. All rights reserved.`}
          </p>
          <p className="text-xs text-muted-foreground" data-testid="text-footer-tagline">
            Trusted support animal registration and certification
          </p>
        </div>
      </div>
    </footer>
  );
}
