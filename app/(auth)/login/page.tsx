import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink, signInWithPassword } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "This email is not authorized for this app.",
  invalid_email: "Enter a valid email address.",
  invalid_credentials: "Incorrect email or password.",
  send_failed: "Could not send the sign-in link. Please try again.",
  auth_failed: "That sign-in link is invalid or has expired.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Health OS</CardTitle>
          <CardDescription>
            Sign in with your email and password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signInWithPassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
            {sent && (
              <p className="text-sm text-muted-foreground">
                Check your inbox — a sign-in link is on its way.
              </p>
            )}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              formAction={sendMagicLink}
              formNoValidate
            >
              Email me a magic link instead
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
