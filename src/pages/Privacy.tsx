export default function Privacy() {
  return (
    <div className="container max-w-2xl py-16">
      <div className="gold-rule" />
      <h1 className="mt-4 font-display text-4xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: July 2026</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="font-display text-xl mb-2">What we collect</h2>
          <p>
            When you create an account: your name, email address, and a securely
            hashed password. When you use the app: deals you save, properties you
            watch, and standard technical logs. Payments, if you subscribe, are
            processed by Stripe — we never see your card number.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl mb-2">How we use it</h2>
          <p>
            To run your account, save your work, and improve the product. We do
            not sell your personal information. We don't send marketing email
            unless you opt in.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl mb-2">Where it lives</h2>
          <p>
            Account data is stored with Supabase (our database and
            authentication provider) with row-level security, and the site is
            hosted on Vercel. Map imagery is served by Google Maps, which may
            set its own cookies subject to Google's privacy policy.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl mb-2">Property data</h2>
          <p>
            The permits and property records shown in Pencil are public
            government records, displayed as published by the issuing agencies.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl mb-2">Your choices</h2>
          <p>
            You can request a copy or deletion of your account data any time at{" "}
            <a className="text-gold hover:underline" href="mailto:hello@pencil.app">hello@pencil.app</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
