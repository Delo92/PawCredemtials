import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useConfig } from "@/contexts/ConfigContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  CreditCard,
  Users,
  Shield,
  Clock,
  MessageSquare,
} from "lucide-react";

function getMediaType(url: string): 'image' | 'video' | 'gif' {
  const extension = url.split('?')[0].split('.').pop()?.toLowerCase();
  if (['mp4', 'webm', 'ogg', 'mov'].includes(extension || '')) {
    return 'video';
  }
  if (extension === 'gif') {
    return 'gif';
  }
  return 'image';
}

export default function Home() {
  const { config } = useConfig();
  const { isAuthenticated, user } = useAuth();

  const heroMediaUrl = config.heroMediaUrl || config.heroBackgroundUrl;
  const mediaType = heroMediaUrl ? getMediaType(heroMediaUrl) : null;

  const getDashboardPath = () => {
    if (!user) return "/register";
    switch (user.userLevel) {
      case 1: return "/dashboard/applicant";
      case 2: return "/dashboard/reviewer";
      case 3: return "/dashboard/agent";
      case 4: return "/dashboard/admin";
      case 5: return "/dashboard/owner";
      default: return "/";
    }
  };

  const features = [
    {
      icon: FileText,
      title: "Legitimate Documentation",
      description: "Professionally prepared medical notes that meet standard requirements for work or school.",
    },
    {
      icon: CreditCard,
      title: "Secure Payment",
      description: "Safe and discreet payment processing with multiple payment options available.",
    },
    {
      icon: Users,
      title: "Medical Review",
      description: "Licensed medical professionals review and approve all documentation.",
    },
    {
      icon: Shield,
      title: "100% Confidential",
      description: "Your personal information is encrypted and never shared with third parties.",
    },
    {
      icon: Clock,
      title: "Fast Delivery",
      description: "Receive your doctor's note within hours, not days. Same-day options available.",
    },
    {
      icon: MessageSquare,
      title: "24/7 Support",
      description: "Get help anytime through our secure messaging system or live chat.",
    },
  ];

  const steps = [
    { step: 1, title: "Create Account", description: "Quick signup with just your email and basic info" },
    { step: 2, title: "Choose Your Note", description: "Select the type of doctor's note you need" },
    { step: 3, title: "Provide Details", description: "Enter the dates and any specific requirements" },
    { step: 4, title: "Receive Your Note", description: "Get your verified doctor's note delivered digitally" },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section 
        className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-20 md:py-32"
        style={heroMediaUrl && mediaType === 'image' ? {
          backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${heroMediaUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        {/* Video Background */}
        {heroMediaUrl && mediaType === 'video' && (
          <>
            <video
              className="absolute inset-0 w-full h-full object-cover"
              src={heroMediaUrl}
              autoPlay
              loop
              muted
              playsInline
              data-testid="video-hero-background"
            />
            <div className="absolute inset-0 bg-black/50" />
          </>
        )}
        
        {/* GIF Background */}
        {heroMediaUrl && mediaType === 'gif' && (
          <>
            <img
              className="absolute inset-0 w-full h-full object-cover"
              src={heroMediaUrl}
              alt="Hero background"
              data-testid="img-hero-gif-background"
            />
            <div className="absolute inset-0 bg-black/50" />
          </>
        )}
        
        {!heroMediaUrl && <div className="absolute inset-0 bg-grid-pattern opacity-5" />}
        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4" data-testid="badge-tagline">
              {config.tagline}
            </Badge>
            <h1 
              className={`text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl mb-6 ${heroMediaUrl ? 'text-white' : ''}`} 
              data-testid="text-hero-title"
            >
              {config.heroTitle || config.siteName}
            </h1>
            <p 
              className={`text-lg md:text-xl mb-8 max-w-2xl mx-auto ${heroMediaUrl ? 'text-white/90' : 'text-muted-foreground'}`} 
              data-testid="text-hero-description"
            >
              {config.heroSubtitle || config.description || "A comprehensive platform for managing applications, documents, and approvals. Start your application today and get approved quickly."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <Button size="lg" asChild data-testid="button-hero-dashboard">
                  <Link href={getDashboardPath()}>
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" asChild data-testid="button-hero-start">
                    <Link href={config.heroButtonLink || "/register"}>
                      {config.heroButtonText || "Get Started"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild data-testid="button-hero-learn" className={heroMediaUrl ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : ''}>
                    <Link href={config.heroSecondaryButtonLink || "/packages"}>
                      {config.heroSecondaryButtonText || "View Services"}
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-4" data-testid="text-features-title">
              Why Choose Us
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We make getting a doctor's note simple, fast, and completely confidential.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={index} className="hover-elevate transition-all duration-200" data-testid={`card-feature-${index}`}>
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20" id="how-it-works">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-4" data-testid="text-steps-title">
              How It Works
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get your doctor's note in four simple steps. No appointments, no waiting rooms.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((item) => (
              <div key={item.step} className="relative" data-testid={`step-${item.step}`}>
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </div>
                {item.step < steps.length && (
                  <div className="hidden lg:block absolute top-7 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-4" data-testid="text-cta-title">
              Need a Doctor's Note Now?
            </h2>
            <p className="text-primary-foreground/80 mb-8 text-lg">
              Join thousands of satisfied customers who got their documentation quickly and discreetly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild data-testid="button-cta-start">
                <Link href="/register">
                  Get Your Note Today
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild data-testid="button-cta-contact">
                <Link href="/contact">Contact Us</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-12 border-t">
        <div className="container">
          <div className="flex flex-wrap items-center justify-center gap-8 text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-chart-2" />
              <span className="text-sm font-medium">Secure & Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-chart-2" />
              <span className="text-sm font-medium">Fast Processing</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-chart-2" />
              <span className="text-sm font-medium">24/7 Support</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-chart-2" />
              <span className="text-sm font-medium">Money Back Guarantee</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
