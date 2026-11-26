import { getPlatformSettings, show } from "@/lib/legal";
import { platformName } from "@/lib/platform";
import { Address, LegalPage } from "@/components/public/legal";

export const metadata = { title: "Impressum" };

export default async function ImprintPage() {
  const s = await getPlatformSettings();
  return (
    <LegalPage title="Impressum" updated="November 2026">
      <p>Informationen nach § 5 E-Commerce-Gesetz, § 14 Unternehmensgesetzbuch und Offenlegung nach § 25 Mediengesetz.</p>

      <h2>Diensteanbieter und Medieninhaber</h2>
      <Address
        lines={[
          `${show(s.operatorName, "Name bzw. Firma")}${s.legalForm ? `, ${s.legalForm}` : ""}`,
          show(s.street, "Straße"),
          show(s.zipCity, "PLZ Ort"),
          s.country,
        ]}
      />

      <dl>
        <dt>E-Mail</dt>
        <dd>{s.email ? <a href={`mailto:${s.email}`}>{s.email}</a> : show(null, "E-Mail")}</dd>
        {s.phone && (
          <>
            <dt>Telefon</dt>
            <dd>{s.phone}</dd>
          </>
        )}
        <dt>Unternehmensgegenstand</dt>
        <dd>{show(s.businessPurpose, "Unternehmensgegenstand")}</dd>
        {s.vatId && (
          <>
            <dt>UID-Nummer</dt>
            <dd>{s.vatId}</dd>
          </>
        )}
        {s.companyRegister && (
          <>
            <dt>Firmenbuch</dt>
            <dd>{s.companyRegister}</dd>
          </>
        )}
        {s.representative && (
          <>
            <dt>Vertretungsbefugt</dt>
            <dd>{s.representative}</dd>
          </>
        )}
        {s.authority && (
          <>
            <dt>Gewerbebehörde</dt>
            <dd>{s.authority}</dd>
          </>
        )}
        {s.chamber && (
          <>
            <dt>Kammer, Berufsrecht</dt>
            <dd>{s.chamber}</dd>
          </>
        )}
      </dl>

      <h2>Grundlegende Richtung</h2>
      <p>Information über die Software „{platformName()}“ zur Verwaltung von Vereinen sowie deren Betrieb für Vereine.</p>

      <h2>Vereinsbereiche</h2>
      <p>
        Für die Inhalte in den Bereichen der einzelnen Vereine (Adressen der Form{" "}
        <em>
          verein.{"<"}domain{">"}
        </em>
        ) ist der jeweilige Verein verantwortlich. Wir stellen dafür nur die technische Plattform bereit.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Für Inhalte verlinkter externer Seiten sind ausschließlich deren Betreiber verantwortlich. Bei Bekanntwerden von Rechtsverletzungen entfernen wir solche
        Links umgehend.
      </p>
    </LegalPage>
  );
}
