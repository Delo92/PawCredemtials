import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WhiteLabelConfig } from "@shared/config";
import { Loader2, Palette, Users, Building2, Save, LayoutTemplate, Link as LinkIcon, Plus, Trash2, Image, GripVertical, Upload } from "lucide-react";

const footerLinkSchema = z.object({
  label: z.string().min(1, "Label is required"),
  url: z.string().min(1, "URL is required"),
});

const galleryImageSchema = z.object({
  url: z.string().min(1, "Image URL is required"),
});

const configSchema = z.object({
  siteName: z.string().min(1, "Site name is required"),
  tagline: z.string().optional(),
  description: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  faviconUrl: z.string().url().optional().or(z.literal("")),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional().or(z.literal("")),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional().or(z.literal("")),
  heroTitle: z.string().optional(),
  heroSubtitle: z.string().optional(),
  heroBackgroundUrl: z.string().url().optional().or(z.literal("")),
  heroMediaUrl: z.string().url().optional().or(z.literal("")),
  heroButtonText: z.string().optional(),
  heroButtonLink: z.string().optional(),
  heroSecondaryButtonText: z.string().optional(),
  heroSecondaryButtonLink: z.string().optional(),
  footerQuickLinks: z.array(footerLinkSchema).optional(),
  footerLegalLinks: z.array(footerLinkSchema).optional(),
  footerText: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  galleryImages: z.array(galleryImageSchema).optional(),
  level1Name: z.string().min(1, "Level 1 name is required"),
  level2Name: z.string().min(1, "Level 2 name is required"),
  level3Name: z.string().min(1, "Level 3 name is required"),
  level4Name: z.string().min(1, "Level 4 name is required"),
  level5Name: z.string().min(1, "Level 5 name is required"),
});

type ConfigFormData = z.infer<typeof configSchema>;

export default function SiteSettings() {
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery<WhiteLabelConfig>({
    queryKey: ["/api/config"],
  });

  const form = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      siteName: "",
      tagline: "",
      description: "",
      logoUrl: "",
      faviconUrl: "",
      primaryColor: "#3b82f6",
      secondaryColor: "#6366f1",
      accentColor: "#0ea5e9",
      heroTitle: "",
      heroSubtitle: "",
      heroBackgroundUrl: "",
      heroMediaUrl: "",
      heroButtonText: "Get Started",
      heroButtonLink: "/register",
      heroSecondaryButtonText: "View Services",
      heroSecondaryButtonLink: "/packages",
      footerQuickLinks: [
        { label: "Home", url: "/" },
        { label: "Services", url: "/packages" },
        { label: "About Us", url: "/about" },
        { label: "Contact", url: "/contact" }
      ],
      footerLegalLinks: [
        { label: "Privacy Policy", url: "/privacy" },
        { label: "Terms of Service", url: "/terms" }
      ],
      footerText: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
      galleryImages: [],
      level1Name: "Applicant",
      level2Name: "Reviewer",
      level3Name: "Agent",
      level4Name: "Admin",
      level5Name: "Owner",
    },
  });

  const { fields: quickLinkFields, append: appendQuickLink, remove: removeQuickLink } = useFieldArray({
    control: form.control,
    name: "footerQuickLinks",
  });

  const { fields: legalLinkFields, append: appendLegalLink, remove: removeLegalLink } = useFieldArray({
    control: form.control,
    name: "footerLegalLinks",
  });

  const { fields: galleryFields, append: appendGallery, remove: removeGallery } = useFieldArray({
    control: form.control,
    name: "galleryImages",
  });

  useEffect(() => {
    if (config) {
      form.reset({
        siteName: config.siteName || "",
        tagline: config.tagline || "",
        description: config.description || "",
        logoUrl: config.logoUrl || "",
        faviconUrl: config.faviconUrl || "",
        primaryColor: config.primaryColor || "#3b82f6",
        secondaryColor: config.secondaryColor || "#6366f1",
        accentColor: config.accentColor || "#0ea5e9",
        heroTitle: config.heroTitle || "",
        heroSubtitle: config.heroSubtitle || "",
        heroBackgroundUrl: config.heroBackgroundUrl || "",
        heroMediaUrl: config.heroMediaUrl || "",
        heroButtonText: config.heroButtonText || "Get Started",
        heroButtonLink: config.heroButtonLink || "/register",
        heroSecondaryButtonText: config.heroSecondaryButtonText || "View Services",
        heroSecondaryButtonLink: config.heroSecondaryButtonLink || "/packages",
        footerQuickLinks: config.footerQuickLinks || [
          { label: "Home", url: "/" },
          { label: "Services", url: "/packages" },
          { label: "About Us", url: "/about" },
          { label: "Contact", url: "/contact" }
        ],
        footerLegalLinks: config.footerLegalLinks || [
          { label: "Privacy Policy", url: "/privacy" },
          { label: "Terms of Service", url: "/terms" }
        ],
        footerText: config.footerText || "",
        contactEmail: config.contactEmail || "",
        contactPhone: config.contactPhone || "",
        address: config.address || "",
        galleryImages: (config.galleryImages || []).map((url: string) => ({ url })),
        level1Name: config.levelNames?.level1 || "Applicant",
        level2Name: config.levelNames?.level2 || "Reviewer",
        level3Name: config.levelNames?.level3 || "Agent",
        level4Name: config.levelNames?.level4 || "Admin",
        level5Name: config.levelNames?.level5 || "Owner",
      });
    }
  }, [config, form]);

  const updateConfig = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await apiRequest("PUT", "/api/owner/config", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      toast({
        title: "Settings Saved",
        description: "Your site configuration has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ConfigFormData) => {
    const { galleryImages, ...rest } = data;
    const payload: Record<string, unknown> = {
      ...rest,
      galleryImages: (galleryImages || []).map((item) => item.url).filter(Boolean),
    };
    updateConfig.mutate(payload);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">
            Site Settings
          </h1>
          <p className="text-muted-foreground">
            Configure your platform's branding and settings
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs defaultValue="branding" className="space-y-6">
              <TabsList className="flex-wrap">
                <TabsTrigger value="branding" data-testid="tab-branding">
                  <Palette className="mr-2 h-4 w-4" />
                  Branding
                </TabsTrigger>
                <TabsTrigger value="hero" data-testid="tab-hero">
                  <LayoutTemplate className="mr-2 h-4 w-4" />
                  Hero Section
                </TabsTrigger>
                <TabsTrigger value="gallery" data-testid="tab-gallery">
                  <Image className="mr-2 h-4 w-4" />
                  Gallery
                </TabsTrigger>
                <TabsTrigger value="footer" data-testid="tab-footer">
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Footer
                </TabsTrigger>
                <TabsTrigger value="roles" data-testid="tab-roles">
                  <Users className="mr-2 h-4 w-4" />
                  Role Names
                </TabsTrigger>
                <TabsTrigger value="contact" data-testid="tab-contact">
                  <Building2 className="mr-2 h-4 w-4" />
                  Contact Info
                </TabsTrigger>
              </TabsList>

              <TabsContent value="branding">
                <Card>
                  <CardHeader>
                    <CardTitle>Branding</CardTitle>
                    <CardDescription>
                      Customize your platform's appearance
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="siteName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site Name</FormLabel>
                          <FormControl>
                            <Input placeholder="My Application Portal" data-testid="input-site-name" {...field} />
                          </FormControl>
                          <FormDescription>
                            This appears in the header and page titles
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="tagline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tagline</FormLabel>
                          <FormControl>
                            <Input placeholder="Your trusted application partner" data-testid="input-tagline" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="A brief description of your platform..."
                              data-testid="input-description"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="primaryColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Color</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Input
                                  type="color"
                                  className="w-12 h-10 p-1 cursor-pointer"
                                  {...field}
                                />
                                <Input
                                  placeholder="#3b82f6"
                                  className="flex-1"
                                  data-testid="input-primary-color"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="secondaryColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Secondary Color</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Input
                                  type="color"
                                  className="w-12 h-10 p-1 cursor-pointer"
                                  value={field.value || "#6366f1"}
                                  onChange={field.onChange}
                                />
                                <Input
                                  placeholder="#6366f1"
                                  className="flex-1"
                                  data-testid="input-secondary-color"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="accentColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Accent Color</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Input
                                  type="color"
                                  className="w-12 h-10 p-1 cursor-pointer"
                                  value={field.value || "#0ea5e9"}
                                  onChange={field.onChange}
                                />
                                <Input
                                  placeholder="#0ea5e9"
                                  className="flex-1"
                                  data-testid="input-accent-color"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="logoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logo URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com/logo.png" data-testid="input-logo-url" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="hero">
                <Card>
                  <CardHeader>
                    <CardTitle>Hero Section</CardTitle>
                    <CardDescription>
                      Customize the main landing page hero area
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="heroTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hero Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Leave blank to use site name" data-testid="input-hero-title" {...field} />
                          </FormControl>
                          <FormDescription>
                            The main headline on your landing page. Leave blank to use the site name.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="heroSubtitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hero Subtitle</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="A compelling subtitle for your hero section..."
                              data-testid="input-hero-subtitle"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Appears below the main title. Leave blank to use the description.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="heroMediaUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hero Media URL (Image, Video, or GIF)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com/hero.mp4" data-testid="input-hero-media" {...field} />
                          </FormControl>
                          <FormDescription>
                            Add an image (.jpg, .png), video (.mp4, .webm), or GIF to display in the hero section. Videos and GIFs will autoplay on loop.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="heroButtonText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Button Text</FormLabel>
                            <FormControl>
                              <Input placeholder="Get Started" data-testid="input-hero-btn-text" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="heroButtonLink"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Button Link</FormLabel>
                            <FormControl>
                              <Input placeholder="/register" data-testid="input-hero-btn-link" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="heroSecondaryButtonText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Secondary Button Text</FormLabel>
                            <FormControl>
                              <Input placeholder="View Services" data-testid="input-hero-sec-btn-text" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="heroSecondaryButtonLink"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Secondary Button Link</FormLabel>
                            <FormControl>
                              <Input placeholder="/packages" data-testid="input-hero-sec-btn-link" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="gallery">
                <Card>
                  <CardHeader>
                    <CardTitle>Gallery Images</CardTitle>
                    <CardDescription>
                      Manage the images displayed in the gallery section on your landing page. Upload images or paste URLs to showcase your facilities and team.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {galleryFields.length === 0 && (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No gallery images added yet. Upload an image or add a URL below.
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {galleryFields.map((field, index) => {
                        const imageUrl = form.watch(`galleryImages.${index}.url`);
                        return (
                          <div key={field.id} className="group relative rounded-md border overflow-visible" data-testid={`gallery-item-${index}`}>
                            {imageUrl ? (
                              <div className="aspect-video bg-muted">
                                <img
                                  key={imageUrl}
                                  src={imageUrl}
                                  alt={`Gallery image ${index + 1}`}
                                  className="h-full w-full object-cover rounded-t-md"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  data-testid={`img-gallery-preview-${index}`}
                                />
                              </div>
                            ) : (
                              <div className="aspect-video bg-muted flex items-center justify-center rounded-t-md">
                                <Image className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                            <div className="p-2 space-y-2">
                              <FormField
                                control={form.control}
                                name={`galleryImages.${index}.url`}
                                render={({ field: urlField }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        placeholder="Paste image URL..."
                                        className="text-xs"
                                        data-testid={`input-gallery-url-${index}`}
                                        {...urlField}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => {
                                    const input = document.createElement("input");
                                    input.type = "file";
                                    input.accept = "image/jpeg,image/png,image/gif,image/webp,image/svg+xml";
                                    input.onchange = async (e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                      if (!file) return;
                                      const formData = new FormData();
                                      formData.append("image", file);
                                      try {
                                        const response = await fetch("/api/upload/gallery", {
                                          method: "POST",
                                          body: formData,
                                          credentials: "include",
                                        });
                                        if (!response.ok) {
                                          const err = await response.json();
                                          throw new Error(err.message || "Upload failed");
                                        }
                                        const data = await response.json();
                                        form.setValue(`galleryImages.${index}.url`, data.url);
                                        toast({ title: "Image uploaded" });
                                      } catch (err: any) {
                                        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
                                      }
                                    };
                                    input.click();
                                  }}
                                  data-testid={`button-upload-gallery-${index}`}
                                >
                                  <Upload className="mr-1 h-3 w-3" />
                                  Upload
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeGallery(index)}
                                  data-testid={`button-remove-gallery-${index}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => appendGallery({ url: "" })}
                        data-testid="button-add-gallery"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Image Slot
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/jpeg,image/png,image/gif,image/webp,image/svg+xml";
                          input.multiple = true;
                          input.onchange = async (e) => {
                            const files = (e.target as HTMLInputElement).files;
                            if (!files || files.length === 0) return;
                            for (let i = 0; i < files.length; i++) {
                              const formData = new FormData();
                              formData.append("image", files[i]);
                              try {
                                const response = await fetch("/api/upload/gallery", {
                                  method: "POST",
                                  body: formData,
                                  credentials: "include",
                                });
                                if (!response.ok) {
                                  const err = await response.json();
                                  throw new Error(err.message || "Upload failed");
                                }
                                const data = await response.json();
                                appendGallery({ url: data.url });
                              } catch (err: any) {
                                toast({ title: "Upload failed", description: err.message, variant: "destructive" });
                              }
                            }
                            toast({ title: `${files.length} image(s) uploaded` });
                          };
                          input.click();
                        }}
                        data-testid="button-upload-multiple-gallery"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Images
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="footer">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Quick Links</CardTitle>
                      <CardDescription>
                        Navigation links displayed in the footer
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {quickLinkFields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 items-start">
                          <FormField
                            control={form.control}
                            name={`footerQuickLinks.${index}.label`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormControl>
                                  <Input placeholder="Link Label" data-testid={`input-quick-link-label-${index}`} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`footerQuickLinks.${index}.url`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormControl>
                                  <Input placeholder="/page-url" data-testid={`input-quick-link-url-${index}`} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeQuickLink(index)}
                            data-testid={`button-remove-quick-link-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => appendQuickLink({ label: "", url: "" })}
                        data-testid="button-add-quick-link"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Quick Link
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Legal Links</CardTitle>
                      <CardDescription>
                        Legal and policy links for the footer
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {legalLinkFields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 items-start">
                          <FormField
                            control={form.control}
                            name={`footerLegalLinks.${index}.label`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormControl>
                                  <Input placeholder="Link Label" data-testid={`input-legal-link-label-${index}`} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`footerLegalLinks.${index}.url`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormControl>
                                  <Input placeholder="/privacy" data-testid={`input-legal-link-url-${index}`} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLegalLink(index)}
                            data-testid={`button-remove-legal-link-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => appendLegalLink({ label: "", url: "" })}
                        data-testid="button-add-legal-link"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Legal Link
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Footer Text</CardTitle>
                      <CardDescription>
                        Additional text or copyright notice for the footer
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="footerText"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                placeholder="© 2026 Your Company. All rights reserved."
                                data-testid="input-footer-text"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Custom copyright or additional footer text
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="roles">
                <Card>
                  <CardHeader>
                    <CardTitle>Role Names</CardTitle>
                    <CardDescription>
                      Customize the names for each user level in your platform
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="level1Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Level 1 (Default Users)</FormLabel>
                          <FormControl>
                            <Input placeholder="Applicant" data-testid="input-level1" {...field} />
                          </FormControl>
                          <FormDescription>
                            Examples: Applicant, Pet Owner, Patient, Customer
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="level2Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Level 2 (Reviewers)</FormLabel>
                          <FormControl>
                            <Input placeholder="Reviewer" data-testid="input-level2" {...field} />
                          </FormControl>
                          <FormDescription>
                            Examples: Reviewer, Veterinarian, Doctor, Specialist
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="level3Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Level 3 (Agents)</FormLabel>
                          <FormControl>
                            <Input placeholder="Agent" data-testid="input-level3" {...field} />
                          </FormControl>
                          <FormDescription>
                            Examples: Agent, Partner, Affiliate, Referrer
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="level4Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Level 4 (Administrators)</FormLabel>
                          <FormControl>
                            <Input placeholder="Admin" data-testid="input-level4" {...field} />
                          </FormControl>
                          <FormDescription>
                            Examples: Admin, Manager, Supervisor, Coordinator
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="level5Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Level 5 (Owners)</FormLabel>
                          <FormControl>
                            <Input placeholder="Owner" data-testid="input-level5" {...field} />
                          </FormControl>
                          <FormDescription>
                            Examples: Owner, Super Admin, Director, Principal
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contact">
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                    <CardDescription>
                      Your platform's contact details for users
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="contactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="support@example.com" data-testid="input-contact-email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 555-5555" data-testid="input-contact-phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="123 Main St, City, State 12345"
                              data-testid="input-address"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end mt-6">
              <Button type="submit" disabled={updateConfig.isPending} data-testid="button-save-settings">
                {updateConfig.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
