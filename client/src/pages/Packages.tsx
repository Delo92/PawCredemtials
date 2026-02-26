import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { AnimateOnScroll } from "@/hooks/use-scroll-animation";
import type { Package } from "@shared/schema";
import { CheckCircle2, ArrowRight, Shield, Clock, Stethoscope } from "lucide-react";

export default function Packages() {
  const { isAuthenticated } = useAuth();
  
  const { data: packages, isLoading } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
  });

  const activePackages = packages?.filter((p) => p.isActive) || [];

  return (
    <div className="flex flex-col">
      <div className="relative py-20 md:py-24 overflow-hidden">
        <img src="https://storage.googleapis.com/paw-credentials.firebasestorage.app/defaults/hero-bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-primary/85" />
        <div className="container relative z-10">
          <div className="text-center text-primary-foreground">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 !text-white" data-testid="text-packages-title">
              Support Animal Registration Packages
            </h1>
            <p className="text-primary-foreground/80 max-w-2xl mx-auto text-lg">
              Choose the registration package you need. All certifications are reviewed by licensed professionals and delivered digitally.
            </p>
          </div>
        </div>
      </div>

      <div className="container py-16 md:py-20">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-2/3 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-1/3 mb-4" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : activePackages.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activePackages.map((pkg, idx) => (
              <AnimateOnScroll key={pkg.id} animation="fade-up" delay={idx * 100}>
                <Card className="flex flex-col hover-elevate transition-all shadow-md h-full" data-testid={`card-package-${pkg.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <CardTitle className="text-xl">{pkg.name}</CardTitle>
                      {pkg.state && (
                        <Badge variant="secondary">{pkg.state}</Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {pkg.description || "Service package"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="text-4xl font-bold mb-6" data-testid={`text-price-${pkg.id}`}>
                      ${(Number(pkg.price) / 100).toFixed(2)}
                    </div>
                    <ul className="space-y-3">
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-chart-2 shrink-0" />
                        <span>Licensed professional review</span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-chart-2 shrink-0" />
                        <span>Digital delivery</span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-chart-2 shrink-0" />
                        <span>Same-day processing</span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-chart-2 shrink-0" />
                        <span>Legally recognized</span>
                      </li>
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" asChild data-testid={`button-select-${pkg.id}`}>
                      <Link href={isAuthenticated ? `/dashboard/applicant/applications/new?package=${pkg.id}` : `/register?package=${pkg.id}`}>
                        Select Package
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              </AnimateOnScroll>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4" data-testid="text-no-packages">No services available at this time.</p>
            <Button variant="outline" asChild data-testid="button-return-home">
              <Link href="/">Return Home</Link>
            </Button>
          </div>
        )}

        <AnimateOnScroll animation="fade-up">
          <div className="mt-20 grid md:grid-cols-3 gap-8">
            {[
              { icon: Stethoscope, title: "Licensed Professionals", desc: "Every certification is reviewed and signed by licensed professionals." },
              { icon: Clock, title: "Same-Day Processing", desc: "Most applications are processed and delivered within hours." },
              { icon: Shield, title: "Complete Privacy", desc: "Your information is encrypted and never shared with third parties." },
            ].map((item, i) => (
              <div key={i} className="text-center" data-testid={`packages-feature-${i}`}>
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll animation="fade-up">
          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold mb-4" data-testid="text-faq-heading">Have Questions?</h2>
            <p className="text-muted-foreground mb-6">
              Our support team is available 24/7 to help you find the right registration package.
            </p>
            <Button variant="outline" asChild data-testid="button-view-faq">
              <Link href="/#faq">View FAQ</Link>
            </Button>
          </div>
        </AnimateOnScroll>
      </div>
    </div>
  );
}
