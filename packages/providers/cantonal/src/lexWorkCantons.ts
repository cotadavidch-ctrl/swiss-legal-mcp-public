export interface LexWorkCantonDescriptor {
  readonly cantonCode: string;
  readonly cantonName: string;
  readonly baseUrl: string;
  readonly domains: readonly string[];
  readonly language: "de" | "fr";
}

/**
 * Los 19 cantones confirmados EN VIVO (Fase 5B) sobre la plataforma
 * comercial LexWork (Sitrox): titulo de pagina "LexWork" y/o respuesta JSON
 * real en `/api/{language}/systematic_categories` con la misma forma que
 * Berna. Ver docs/providers/cantonal-legislation.md para la evidencia
 * completa por canton (URL exacta comprobada, robots.txt, ejemplo real).
 *
 * AR/AI/BL viven en el dominio compartido del vendor (`clex.ch`), no en un
 * dominio gubernamental `*.ar.ch`/`*.ai.ch`/`*.bl.ch` propio -- las paginas
 * gubernamentales que enlazarian ahi devolvieron HTTP 403 durante la
 * auditoria, asi que el enlace saliente exacto no se confirmo visualmente,
 * solo el sistema real al que apuntan (mismo esquema de API). FR: el
 * dominio de infraestructura del vendor (`fr.lexwork.naz.ch`) respondio en
 * la auditoria inicial pero dejo de responder (404) en una verificacion
 * posterior; se usa el dominio oficial de gobierno (`bdlf.fr.ch`), que
 * respondio JSON real y consistente en ambas verificaciones.
 */
export const LEXWORK_CANTONS: readonly LexWorkCantonDescriptor[] = [
  {
    cantonCode: "BE",
    cantonName: "Bern",
    baseUrl: "https://www.belex.sites.be.ch",
    domains: ["belex.sites.be.ch"],
    language: "de",
  },
  {
    cantonCode: "LU",
    cantonName: "Luzern",
    baseUrl: "https://srl.lu.ch",
    domains: ["srl.lu.ch"],
    language: "de",
  },
  {
    cantonCode: "UR",
    cantonName: "Uri",
    baseUrl: "https://rechtsbuch.ur.ch",
    domains: ["rechtsbuch.ur.ch"],
    language: "de",
  },
  {
    cantonCode: "OW",
    cantonName: "Obwalden",
    baseUrl: "https://gdb.ow.ch",
    domains: ["gdb.ow.ch"],
    language: "de",
  },
  {
    cantonCode: "NW",
    cantonName: "Nidwalden",
    baseUrl: "https://gesetze.nw.ch",
    domains: ["gesetze.nw.ch"],
    language: "de",
  },
  {
    cantonCode: "GL",
    cantonName: "Glarus",
    baseUrl: "https://gesetze.gl.ch",
    domains: ["gesetze.gl.ch"],
    language: "de",
  },
  {
    cantonCode: "ZG",
    cantonName: "Zug",
    baseUrl: "https://bgs.zg.ch",
    domains: ["bgs.zg.ch"],
    language: "de",
  },
  {
    cantonCode: "SH",
    cantonName: "Schaffhausen",
    baseUrl: "https://rechtsbuch.sh.ch",
    domains: ["rechtsbuch.sh.ch"],
    language: "de",
  },
  {
    cantonCode: "AR",
    cantonName: "Appenzell Ausserrhoden",
    baseUrl: "https://ar.clex.ch",
    domains: ["ar.clex.ch"],
    language: "de",
  },
  {
    cantonCode: "AI",
    cantonName: "Appenzell Innerrhoden",
    baseUrl: "https://ai.clex.ch",
    domains: ["ai.clex.ch"],
    language: "de",
  },
  {
    cantonCode: "SG",
    cantonName: "St. Gallen",
    baseUrl: "https://www.gesetzessammlung.sg.ch",
    domains: ["www.gesetzessammlung.sg.ch", "gesetzessammlung.sg.ch"],
    language: "de",
  },
  {
    cantonCode: "GR",
    cantonName: "Graubünden",
    baseUrl: "https://www.gr-lex.gr.ch",
    domains: ["www.gr-lex.gr.ch", "gr-lex.gr.ch"],
    language: "de",
  },
  {
    cantonCode: "AG",
    cantonName: "Aargau",
    baseUrl: "https://gesetzessammlungen.ag.ch",
    domains: ["gesetzessammlungen.ag.ch"],
    language: "de",
  },
  {
    cantonCode: "TG",
    cantonName: "Thurgau",
    baseUrl: "https://www.rechtsbuch.tg.ch",
    domains: ["www.rechtsbuch.tg.ch", "rechtsbuch.tg.ch"],
    language: "de",
  },
  {
    cantonCode: "SO",
    cantonName: "Solothurn",
    baseUrl: "https://bgs.so.ch",
    domains: ["bgs.so.ch"],
    language: "de",
  },
  {
    cantonCode: "BS",
    cantonName: "Basel-Stadt",
    baseUrl: "https://gesetzessammlung.bs.ch",
    domains: ["gesetzessammlung.bs.ch"],
    language: "de",
  },
  {
    cantonCode: "BL",
    cantonName: "Basel-Landschaft",
    baseUrl: "https://bl.clex.ch",
    domains: ["bl.clex.ch"],
    language: "de",
  },
  {
    cantonCode: "FR",
    cantonName: "Fribourg/Freiburg",
    // El dominio de infraestructura del vendor (fr.lexwork.naz.ch), usado en
    // la auditoria inicial, dejo de responder (HTTP 404 verificado en vivo
    // en una comprobacion posterior). El dominio oficial de gobierno
    // (bdlf.fr.ch) SI responde con JSON real en ambos endpoints -- se usa
    // como baseUrl definitivo, ademas de ser la fuente mas apropiada al ser
    // el dominio gubernamental.
    baseUrl: "https://bdlf.fr.ch",
    domains: ["bdlf.fr.ch"],
    language: "fr",
  },
  {
    cantonCode: "VS",
    cantonName: "Valais/Wallis",
    baseUrl: "https://lex.vs.ch",
    domains: ["lex.vs.ch"],
    language: "fr",
  },
];
