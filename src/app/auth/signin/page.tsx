import { Suspense } from "react";
import { SignInForm } from "./SignInForm";

export default function SignInPage() {
  return (
    <Suspense fallback={<p className="font-bold uppercase text-center">Loading...</p>}>
      <SignInForm />
    </Suspense>
  );
}
