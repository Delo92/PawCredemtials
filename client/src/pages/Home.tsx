import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConfig } from "@/contexts/ConfigContext";
import { useAuth } from "@/contexts/AuthContext";
import { AnimateOnScroll } from "@/hooks/use-scroll-animation";
import {
  ArrowRight,
  Users,
  Award,
  FlaskConical,
  Building2,
  ChevronRight,
  ChevronDown,
  Star,
  Heart,
  Stethoscope,
  Clock,
  Shield,
  ClipboardCheck,
  ShieldCheck,
  Pill,
  Dna,
  Accessibility,
  NotebookPen,
  Quote,
} from "lucide-react";

function getMediaType(url: string): 'image' | 'video' | 'gif' {
  const extension = url.split('?')[0].split('.').pop()?.toLowerCase();
  if (['mp4', 'webm', 'ogg', 'mov'].includes(extension || '')) return 'video';
  if (extension === 'gif') return 'gif';
  return 'image';
}

export default function Home() {
  const { config } = useConfig();
  const { isAuthenticated, user } = useAuth();
  const [openFaq, setOpenFaq] = useState(0);
  const [activeDept, setActiveDept] = useState(0);

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

  const services = [
    { icon: Heart, title: "Work Absence Notes", description: "Professional documentation for excused absences from work, reviewed by licensed providers." },
    { icon: Pill, title: "School Excuse Notes", description: "Verified medical excuses for school or university absences, delivered same day." },
    { icon: Stethoscope, title: "Medical Clearance", description: "Clearance documentation for return to work, sports, or other activities." },
    { icon: Dna, title: "Custom Medical Notes", description: "Tailored medical documentation for specific needs with professional review." },
    { icon: Accessibility, title: "Accommodation Letters", description: "Documentation supporting workplace or educational accommodations." },
    { icon: NotebookPen, title: "Urgent Requests", description: "Priority processing for time-sensitive documentation needs." },
  ];

  const stats = [
    { icon: Users, value: "10,000+", label: "Customers Served" },
    { icon: Building2, value: "24hr", label: "Processing Time" },
    { icon: FlaskConical, value: "100%", label: "Confidential" },
    { icon: Award, value: "4.9/5", label: "Customer Rating" },
  ];

  const departments = [
    { name: "General Notes", img: "/images/medilab/departments-1.jpg", desc: "Standard doctor's notes for work absences, school excuses, and general medical documentation. Our most popular service with same-day delivery." },
    { name: "Specialist Notes", img: "/images/medilab/departments-2.jpg", desc: "Specialized documentation from specific medical fields including cardiology, neurology, and orthopedics for targeted medical needs." },
    { name: "Clearance Letters", img: "/images/medilab/departments-3.jpg", desc: "Medical clearance documentation for return to work, sports participation, travel, and other activities requiring physician approval." },
    { name: "Accommodation Docs", img: "/images/medilab/departments-4.jpg", desc: "Comprehensive accommodation documentation for workplace or educational settings, including ADA compliance letters." },
    { name: "Urgent Care", img: "/images/medilab/departments-5.jpg", desc: "Priority rush processing for time-sensitive documentation needs. Get your verified medical note within hours." },
  ];

  const faqs = [
    { q: "How quickly will I receive my doctor's note?", a: "Most notes are processed and delivered within a few hours. Our priority service can deliver notes even faster for urgent needs." },
    { q: "Are the doctor's notes legitimate?", a: "Yes, all documentation is reviewed and approved by licensed medical professionals. Our notes meet standard requirements for employers and educational institutions." },
    { q: "Is my personal information kept confidential?", a: "Absolutely. We use industry-standard encryption and never share your personal information with third parties. Your privacy is our top priority." },
    { q: "What types of doctor's notes do you offer?", a: "We offer work absence notes, school excuse notes, medical clearance letters, accommodation documentation, and custom medical notes for various needs." },
    { q: "Can I get a refund if I'm not satisfied?", a: "Yes, we offer a satisfaction guarantee. If your note doesn't meet your needs, contact our support team for assistance." },
    { q: "Do I need to provide medical records?", a: "No medical records are required. Simply provide the basic information about your situation, and our medical team will handle the rest." },
  ];

  const testimonials = [
    { name: "Sarah M.", role: "Working Professional", text: "Got my work absence note within 2 hours. The process was incredibly smooth and professional. Highly recommend!", rating: 5, img: "/images/medilab/testimonials/testimonials-1.jpg" },
    { name: "James K.", role: "College Student", text: "Needed a school excuse note last minute and they delivered. The note was professional and accepted without any issues.", rating: 5, img: "/images/medilab/testimonials/testimonials-2.jpg" },
    { name: "Emily R.", role: "Freelancer", text: "The medical clearance letter was exactly what I needed. Professional, quick, and completely confidential.", rating: 5, img: "/images/medilab/testimonials/testimonials-3.jpg" },
    { name: "Michael D.", role: "Business Owner", text: "Outstanding service. I needed urgent documentation and they delivered within the hour. Will definitely use again.", rating: 5, img: "/images/medilab/testimonials/testimonials-4.jpg" },
    { name: "Lisa T.", role: "Graduate Student", text: "Simple process, legitimate documentation. Exactly what I needed for my university. The customer service was excellent too.", rating: 5, img: "/images/medilab/testimonials/testimonials-5.jpg" },
  ];

  const defaultGalleryImages = [
    "/images/medilab/gallery/gallery-1.jpg",
    "/images/medilab/gallery/gallery-2.jpg",
    "/images/medilab/gallery/gallery-3.jpg",
    "/images/medilab/gallery/gallery-4.jpg",
    "/images/medilab/gallery/gallery-5.jpg",
    "/images/medilab/gallery/gallery-6.jpg",
    "/images/medilab/gallery/gallery-7.jpg",
    "/images/medilab/gallery/gallery-8.jpg",
  ];
  const galleryImages = config.galleryImages && config.galleryImages.length > 0
    ? config.galleryImages
    : defaultGalleryImages;

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center">
        {heroMediaUrl && mediaType === 'image' && (
          <img src={heroMediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" data-testid="img-hero-background" />
        )}
        {heroMediaUrl && mediaType === 'video' && (
          <video className="absolute inset-0 w-full h-full object-cover" src={heroMediaUrl} autoPlay loop muted playsInline data-testid="video-hero-background" />
        )}
        {heroMediaUrl && mediaType === 'gif' && (
          <img className="absolute inset-0 w-full h-full object-cover" src={heroMediaUrl} alt="Hero background" data-testid="img-hero-gif-background" />
        )}
        {!heroMediaUrl && (
          <img src="/images/medilab/hero-bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" data-testid="img-hero-default" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />

        <div className="container relative z-10 py-20">
          <AnimateOnScroll animation="fade-right">
            <div className="bg-primary/85 backdrop-blur-sm text-primary-foreground rounded-md p-8 md:p-12 max-w-xl shadow-xl" data-testid="hero-welcome-box">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 !text-white leading-tight">
                {config.heroTitle || `WELCOME TO ${config.siteName.toUpperCase()}`}
              </h2>
              <p className="text-primary-foreground/90 text-lg mb-6 leading-relaxed">
                {config.heroSubtitle || "Professional medical documentation delivered quickly and discreetly. Trusted by thousands."}
              </p>
              {isAuthenticated ? (
                <Button size="lg" variant="secondary" asChild data-testid="button-hero-dashboard">
                  <Link href={getDashboardPath()}>
                    Go to Dashboard
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button size="lg" variant="secondary" asChild data-testid="button-hero-learn">
                  <Link href={config.heroButtonLink || "/packages"}>
                    {config.heroButtonText || "Learn More"}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </AnimateOnScroll>

          <div className="grid md:grid-cols-3 gap-5 mt-10">
            {[
              { icon: ClipboardCheck, title: "Licensed Professionals", desc: "All documentation reviewed and approved by verified medical providers." },
              { icon: ShieldCheck, title: "100% Confidential", desc: "Your information is encrypted and never shared with third parties." },
              { icon: Clock, title: "Same-Day Delivery", desc: "Receive your verified documentation within hours of submitting your request." },
            ].map((item, i) => (
              <AnimateOnScroll key={i} animation="fade-up" delay={i * 100}>
                <Card className="bg-background/95 backdrop-blur-sm shadow-lg border-0" data-testid={`hero-icon-box-${i}`}>
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="shrink-0 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <item.icon className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold mb-1">{item.title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 md:py-24">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <AnimateOnScroll animation="fade-right">
              <div className="relative">
                <img
                  src="/images/medilab/about.jpg"
                  alt="About our service"
                  className="rounded-md w-full object-cover shadow-lg"
                  data-testid="img-about"
                />
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary rounded-md opacity-20 -z-10" />
              </div>
            </AnimateOnScroll>
            <AnimateOnScroll animation="fade-left">
              <div>
                <h3 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-about-title">
                  About Us
                </h3>
                <div className="w-16 h-1 bg-primary rounded-full mb-6" />
                <p className="text-muted-foreground mb-8 leading-relaxed text-base">
                  We provide fast, professional medical documentation for individuals who need legitimate doctor's notes for work, school, or personal needs. Our licensed medical professionals ensure every document meets the highest standards.
                </p>
                <div className="space-y-6">
                  {[
                    { icon: ShieldCheck, title: "Verified Medical Professionals", desc: "Every note is reviewed and signed by a licensed healthcare provider." },
                    { icon: Clock, title: "Fast Turnaround Time", desc: "Most requests are processed within hours, with priority options available." },
                    { icon: Shield, title: "Complete Privacy Protection", desc: "Your personal health information is encrypted and never shared with anyone." },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4 items-start" data-testid={`about-item-${i}`}>
                      <div className="shrink-0 w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
                        <item.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h5 className="text-base font-bold mb-1">{item.title}</h5>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-[hsl(var(--section-bg))]">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <AnimateOnScroll key={i} animation="zoom-in" delay={i * 100}>
                <div className="flex flex-col items-center" data-testid={`stat-${i}`}>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground mb-3 shadow-lg relative z-10 ring-4 ring-background">
                    <stat.icon className="h-7 w-7" />
                  </div>
                  <Card className="w-full -mt-8 pt-12 pb-6 text-center shadow-md">
                    <CardContent className="p-0">
                      <span className="text-3xl md:text-4xl font-bold block mb-1" data-testid={`text-stat-value-${i}`}>{stat.value}</span>
                      <p className="text-muted-foreground text-sm">{stat.label}</p>
                    </CardContent>
                  </Card>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 md:py-24">
        <div className="container">
          <AnimateOnScroll animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-medium section-title-underline" data-testid="text-services-title">
                Services
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mt-4 text-base">
                Professional medical documentation for every situation, delivered with speed and discretion.
              </p>
            </div>
          </AnimateOnScroll>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service, i) => (
              <AnimateOnScroll key={i} animation="fade-up" delay={i * 80}>
                <div
                  className="border rounded-md p-10 text-center hover-elevate cursor-pointer shadow-sm"
                  data-testid={`card-service-${i}`}
                >
                  <div className="relative mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                    <service.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">
                    {service.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* CTA / Order Section */}
      <section className="relative py-20 md:py-24 overflow-hidden">
        <img src="/images/medilab/hero-bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-primary/90" />
        <div className="container relative z-10">
          <AnimateOnScroll animation="fade-up">
            <div className="text-center max-w-2xl mx-auto text-primary-foreground">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 !text-white" data-testid="text-cta-title">
                Need a Doctor's Note Now?
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-8 leading-relaxed">
                Join thousands of satisfied customers. Get your verified documentation in just a few simple steps.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="secondary" asChild data-testid="button-cta-start">
                  <Link href="/register">
                    Get Your Note Today
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground/30 text-primary-foreground" asChild data-testid="button-cta-services">
                  <Link href="/packages">View Services</Link>
                </Button>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Departments Section */}
      <section className="py-20 md:py-24">
        <div className="container">
          <AnimateOnScroll animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-medium section-title-underline" data-testid="text-departments-title">
                Departments
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mt-4 text-base">
                Explore our specialized documentation services tailored to your specific needs.
              </p>
            </div>
          </AnimateOnScroll>
          <AnimateOnScroll animation="fade-up" delay={100}>
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="lg:w-64 shrink-0">
                <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                  {departments.map((dept, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveDept(i)}
                      className={`text-left px-5 py-4 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                        activeDept === i
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-[hsl(var(--section-bg))] text-foreground hover:bg-primary/10'
                      }`}
                      data-testid={`button-dept-${i}`}
                    >
                      {dept.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div>
                    <h3 className="text-2xl font-bold mb-4">{departments[activeDept].name}</h3>
                    <p className="text-muted-foreground leading-relaxed text-base mb-6">
                      {departments[activeDept].desc}
                    </p>
                    <Button asChild data-testid="button-dept-learn-more">
                      <Link href="/packages">
                        Learn More
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                  <div>
                    <img
                      src={departments[activeDept].img}
                      alt={departments[activeDept].name}
                      className="rounded-md w-full object-cover shadow-lg aspect-[4/3]"
                      data-testid={`img-dept-${activeDept}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 md:py-24 bg-[hsl(var(--section-bg))]">
        <div className="container">
          <AnimateOnScroll animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-medium section-title-underline" data-testid="text-faq-title">
                Frequently Asked Questions
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mt-4 text-base">
                Find answers to common questions about our doctor's note service.
              </p>
            </div>
          </AnimateOnScroll>
          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((faq, i) => (
              <AnimateOnScroll key={i} animation="fade-up" delay={i * 60}>
                <div
                  className={`rounded-md overflow-hidden transition-all duration-300 shadow-sm ${openFaq === i ? 'bg-primary text-primary-foreground shadow-md' : 'bg-background border'}`}
                  data-testid={`faq-item-${i}`}
                >
                  <button
                    className="w-full flex items-center justify-between gap-4 p-5 text-left font-medium"
                    onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                    data-testid={`button-faq-toggle-${i}`}
                  >
                    <span className={`text-base ${openFaq === i ? '!text-white font-semibold' : ''}`}>{faq.q}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? 'max-h-40' : 'max-h-0'}`}>
                    <div className="px-5 pb-5">
                      <p className={`text-sm leading-relaxed ${openFaq === i ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>{faq.a}</p>
                    </div>
                  </div>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 md:py-24">
        <div className="container">
          <div className="grid lg:grid-cols-5 gap-12 items-start">
            <AnimateOnScroll animation="fade-right" className="lg:col-span-2">
              <div>
                <h3 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-testimonials-title">
                  Testimonials
                </h3>
                <div className="w-16 h-1 bg-primary rounded-full mb-6" />
                <p className="text-muted-foreground leading-relaxed text-base">
                  Hear from our satisfied customers who trust us for their medical documentation needs. We're proud to maintain a 4.9/5 rating across thousands of orders.
                </p>
              </div>
            </AnimateOnScroll>
            <div className="lg:col-span-3">
              <div className="space-y-5">
                {testimonials.map((t, i) => (
                  <AnimateOnScroll key={i} animation="fade-up" delay={i * 80}>
                    <Card className="shadow-md border-0 bg-background" data-testid={`testimonial-${i}`}>
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <img
                            src={t.img}
                            alt={t.name}
                            className="h-16 w-16 rounded-full object-cover shrink-0 ring-2 ring-primary/20"
                            data-testid={`img-testimonial-${i}`}
                          />
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                              <div>
                                <h4 className="font-bold text-base" data-testid={`text-testimonial-name-${i}`}>{t.name}</h4>
                                <p className="text-xs text-muted-foreground">{t.role}</p>
                              </div>
                              <div className="flex gap-0.5">
                                {Array(t.rating).fill(null).map((_, j) => (
                                  <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                ))}
                              </div>
                            </div>
                            <div className="relative">
                              <Quote className="absolute -top-1 -left-1 h-5 w-5 text-primary/20" />
                              <p className="text-sm text-muted-foreground italic pl-5 leading-relaxed" data-testid={`text-testimonial-${i}`}>{t.text}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </AnimateOnScroll>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-20 md:py-24 bg-[hsl(var(--section-bg))]">
        <div className="container">
          <AnimateOnScroll animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-medium section-title-underline" data-testid="text-gallery-title">
                Gallery
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mt-4 text-base">
                A glimpse into our professional medical facilities and team.
              </p>
            </div>
          </AnimateOnScroll>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {galleryImages.map((img, i) => (
              <AnimateOnScroll key={i} animation="zoom-in" delay={i * 60}>
                <div className="group relative overflow-hidden rounded-md cursor-pointer aspect-square" data-testid={`gallery-img-${i}`}>
                  <img
                    src={img}
                    alt={`Gallery ${i + 1}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/40 transition-colors duration-300 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                        <ArrowRight className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  </div>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / Final CTA Section */}
      <section id="contact" className="relative py-20 md:py-24 overflow-hidden">
        <img src="/images/medilab/departments-3.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-primary/90" />
        <div className="container relative z-10">
          <AnimateOnScroll animation="fade-up">
            <div className="text-center max-w-2xl mx-auto text-primary-foreground">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 !text-white">
                Ready to Get Started?
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-8 leading-relaxed">
                Create your account today and receive your doctor's note in minutes. Our team is available 24/7 to assist you.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="secondary" asChild data-testid="button-contact-register">
                  <Link href="/register">
                    Create Account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground/30 text-primary-foreground" asChild data-testid="button-contact-services">
                  <Link href="/packages">Browse Services</Link>
                </Button>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </div>
  );
}
