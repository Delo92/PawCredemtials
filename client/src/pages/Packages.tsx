import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import type { Package } from "@shared/schema";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function Packages() {
  const { isAuthenticated } = useAuth();
  
  const { data: packages, isLoading } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
  });

  const activePackages = packages?.filter((p) => p.isActive) || [];

  return (
    <div className="container py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold tracking-tight mb-4" data-testid="text-packages-title">
          Doctor's Note Pricing
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Choose the type of doctor's note you need. All notes are reviewed by licensed medical professionals and delivered digitally.
        </p>
      </div>

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
          {activePackages.map((pkg) => (
            <Card key={pkg.id} className="flex flex-col hover-elevate transition-all" data-testid={`card-package-${pkg.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
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
                <div className="text-3xl font-bold text-primary mb-4">
                  ${Number(pkg.price).toFixed(2)}
                </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-chart-2 shrink-0" />
                    <span>Medical professional review</span>
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
                    <span>100% confidential</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" asChild data-testid={`button-select-${pkg.id}`}>
                  <Link href={isAuthenticated ? `/dashboard/applicant/applications/new?package=${pkg.id}` : `/register?package=${pkg.id}`}>
                    Get This Note
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">No packages available at this time.</p>
          <Button variant="outline" asChild>
            <Link href="/">Return Home</Link>
          </Button>
        </div>
      )}

      {/* FAQ Section */}
      <div className="mt-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Have Questions?</h2>
        <p className="text-muted-foreground mb-6">
          Our support team is available 24/7 to help you get the right documentation.
        </p>
        <Button variant="outline" asChild>
          <Link href="/contact">Contact Us</Link>
        </Button>
      </div>
    </div>
  );
}
