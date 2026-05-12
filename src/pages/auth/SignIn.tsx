import { SignIn } from "@clerk/clerk-react";
import { Wallet } from "lucide-react";

export function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy text-white p-4">
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded bg-amber flex items-center justify-center">
            <Wallet className="h-5 w-5 text-navy" />
          </div>
          <span className="font-bold text-xl">ClaimTrack</span>
        </div>
        <SignIn signUpUrl="/sign-up" afterSignInUrl="/dashboard" />
      </div>
    </div>
  );
}
