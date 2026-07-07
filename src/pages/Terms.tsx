export default function Terms() {
  return (
    <div className="container max-w-2xl py-16">
      <div className="gold-rule" />
      <h1 className="mt-4 font-display text-4xl">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: July 2026</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <p>
          Welcome to Pencil. By creating an account or using pencil at this site,
          you agree to these terms.
        </p>
        <section>
          <h2 className="font-display text-xl mb-2">What Pencil is</h2>
          <p>
            Pencil is a research and analysis tool for real-estate development.
            It maps building permits from public government records, provides
            underwriting calculators, and links to third-party lenders and
            government websites.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl mb-2">Not financial, legal, or investment advice</h2>
          <p>
            Everything in Pencil — underwriting outputs, cost models, market
            figures, lender listings — is for informational purposes only. It is
            not financial, legal, tax, or investment advice, and not an offer of
            credit. Verify all figures independently before committing money to
            any transaction. Pencil is not a broker, lender, or agent.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl mb-2">Data accuracy</h2>
          <p>
            Permit data comes from government open-data sources and is displayed
            as received; estimates are labeled as such. We work hard on accuracy
            but provide the service "as is" without warranties. Public records
            can contain errors, and market figures change.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl mb-2">Your account</h2>
          <p>
            Keep your credentials secure; you're responsible for activity under
            your account. Don't abuse, scrape, resell, or disrupt the service.
            We may suspend accounts that do. You can delete your account at any
            time by contacting us.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl mb-2">Changes</h2>
          <p>
            We may update these terms as the product evolves; continued use
            after changes means acceptance. Questions:{" "}
            <a className="text-gold hover:underline" href="mailto:hello@pencil.app">hello@pencil.app</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
