"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@clinic/shared/schemas/auth";
import { apiFetch } from "@/lib/api-client";
import type { LoginResponse, MembershipSummary } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [memberships, setMemberships] = React.useState<
    MembershipSummary[] | null
  >(null);
  const [submitting, setSubmitting] = React.useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    try {
      const response = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: values,
        skipAuthRetry: true,
      });
      if (response.requiresClinicSelection) {
        setMemberships(response.memberships);
        return;
      }
      router.refresh();
      router.push("/dashboard");
    } catch {
      // Intentionally generic — do not reveal whether the account exists
      // (see docs/threat-model.md T5, account enumeration).
      toast({
        variant: "destructive",
        title: "Sign-in failed",
        description: "Check your email and password and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function selectClinic(membershipId: string) {
    setSubmitting(true);
    try {
      await apiFetch("/auth/select-clinic", {
        method: "POST",
        body: { membershipId },
        skipAuthRetry: true,
      });
      router.refresh();
      router.push("/dashboard");
    } catch {
      toast({
        variant: "destructive",
        title: "Could not continue",
        description: "Please sign in again.",
      });
      setMemberships(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (memberships) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Choose a clinic</CardTitle>
          <CardDescription>
            Your account belongs to more than one clinic.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {memberships.map((m) => (
            <Button
              key={m.membershipId}
              variant="outline"
              className="w-full justify-between"
              disabled={submitting}
              onClick={() => selectClinic(m.membershipId)}
            >
              <span>{m.clinicName}</span>
              <span className="text-muted-foreground">{m.role}</span>
            </Button>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Access your clinic workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link
            href="/forgot-password"
            className="underline underline-offset-4"
          >
            Forgot your password?
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
