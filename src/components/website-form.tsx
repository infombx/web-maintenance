"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Website } from "@/lib/db/schema";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  requirements: z.string().optional(),
  formPrefillData: z.array(
    z.object({
      selector: z.string().min(1, "Selector required"),
      value: z.string(),
      label: z.string().min(1, "Label required"),
    })
  ),
});

type FormValues = z.infer<typeof schema>;

interface WebsiteFormProps {
  website?: Website;
}

export function WebsiteForm({ website }: WebsiteFormProps) {
  const router = useRouter();
  const isEditing = !!website;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: website?.name ?? "",
      url: website?.url ?? "",
      requirements: website?.requirements ?? "",
      formPrefillData: (website?.formPrefillData as FormValues["formPrefillData"]) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "formPrefillData",
  });

  async function onSubmit(values: FormValues) {
    const url = isEditing ? `/api/websites/${website.id}` : "/api/websites";
    const method = isEditing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      toast.error("Failed to save website");
      return;
    }

    const data = await res.json();
    toast.success(isEditing ? "Website updated" : "Website added");
    router.push(`/websites/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="name">Site Name</Label>
        <Input id="name" placeholder="My Client's Website" {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="url">URL</Label>
        <Input id="url" placeholder="https://example.com" {...form.register("url")} />
        {form.formState.errors.url && (
          <p className="text-sm text-red-500">{form.formState.errors.url.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="requirements">Test Requirements</Label>
        <Textarea
          id="requirements"
          placeholder="Describe what to test. E.g.: Test the contact form, check all nav links work, verify the shop checkout flow..."
          rows={4}
          {...form.register("requirements")}
        />
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Form Prefill Data</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Provide values to fill in forms during testing (e.g. contact forms, login fields).
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ selector: "", value: "", label: "" })}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Field
          </Button>
        </div>

        {fields.length > 0 && (
          <Card>
            <CardContent className="pt-4 space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="Label (e.g. Email field)"
                      {...form.register(`formPrefillData.${index}.label`)}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="CSS selector (e.g. input[name=email])"
                      {...form.register(`formPrefillData.${index}.selector`)}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="Value to fill"
                      {...form.register(`formPrefillData.${index}.value`)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? isEditing
              ? "Saving..."
              : "Adding..."
            : isEditing
            ? "Save Changes"
            : "Add Website"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
