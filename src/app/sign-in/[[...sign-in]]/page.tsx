import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#020617",
      }}
    >
      <SignIn
        appearance={{
          elements: {
            rootBox: { margin: "0 auto" },
            card: {
              background: "#0f172a",
              border: "1px solid #1e293b",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
            },
          },
        }}
      />
    </div>
  );
}
