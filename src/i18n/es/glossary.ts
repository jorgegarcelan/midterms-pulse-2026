// Spanish strings for the glossary area, keyed by the English source text.
// Entries mirror src/data/glossary.ts (English stays the source); anchors/ids never change.
export const glossary: Record<string, string> = {
  // Shared keys defined elsewhere (Forecast model, Race directory, How it works, Margin, Win probability, Incumbent, Special election, Prediction market, Close-race probability, Tipping point, Monte Carlo…) are reused, not redefined.
  // Page chrome
  "Glossary — Midterm Pulse 2026": "Glosario — Midterm Pulse 2026",
  "Plain-language definitions of the election and forecasting terms used across Midterm Pulse: generic ballot, tipping point, margin, win probability and more.": "Definiciones en lenguaje claro de los términos electorales y de pronóstico que se usan en Midterm Pulse: voto genérico, escaño decisivo, margen, probabilidad de victoria y más.",
  "GLOSSARY · {count} TERMS": "GLOSARIO · {count} TÉRMINOS",
  "Every term, in plain words.": "Cada término, en palabras sencillas.",
  "What the numbers and labels on this site mean, with an example and a link to where you will meet each one.": "Qué significan las cifras y etiquetas de esta web, con un ejemplo y un enlace a donde encontrarás cada una.",
  "Search the glossary": "Buscar en el glosario",
  "Search a term, e.g. tipping point": "Busca un término, p. ej. escaño decisivo",
  "Jump to letter": "Ir a la letra",
  "No term matches “{query}”.": "Ningún término coincide con «{query}».",

  // Link labels
  "Seat distributions": "Distribuciones de escaños",
  "Model inputs": "Datos de entrada del modelo",
  // "Error budget", "Poll weighting", "Movement", "District map", "Senate builder" live in explainer.ts; "Polls", "Markets" in common.ts.
  "See it run": "Velo en acción",
  "Try the swing slider": "Prueba el control de giro",
  "Chapter 3 on the home page": "Capítulo 3 de la portada",

  // 80% interval
  "80% interval": "Intervalo del 80%",
  "80% range": "rango del 80%",
  "The range the seat count lands in for 8 of every 10 simulations. The remaining 20% of runs fall outside it, 10% on each side.": "El rango en el que cae el número de escaños en 8 de cada 10 simulaciones. El 20% restante queda fuera, un 10% por cada lado.",
  "House: 229–262 Democratic seats means fewer than 229 or more than 262 each happen about 1 time in 10.": "Cámara: 229–262 escaños demócratas significa que menos de 229 o más de 262 ocurre, cada uno, aproximadamente 1 vez de cada 10.",
  // Benchmark
  "Benchmark": "Referencia",
  "The outside race-by-race forecast the model starts from. Midterm Pulse uses Vote-Scope's projection of every House district and Senate race, then adjusts and simulates it.": "El pronóstico externo, carrera a carrera, del que parte el modelo. Midterm Pulse usa la proyección de Vote-Scope para cada distrito de la Cámara y cada carrera al Senado, y después la ajusta y la simula.",
  "If the benchmark has Georgia's Senate race at D+9.3, that is the starting margin before any movement.": "Si la referencia sitúa la carrera al Senado de Georgia en D+9.3, ese es el margen de partida antes de cualquier movimiento.",
  // Close-race probability
  "The benchmark's chance that the race finishes very close, within a few points either way. Close races are the ones most likely to be called late.": "La probabilidad, según la referencia, de que la carrera termine muy ajustada, por unos pocos puntos en cualquier sentido. Las carreras ajustadas son las que más probablemente se proclamen tarde.",
  // Correlated error
  "Correlated error": "Error correlacionado",
  "national error, shared error": "error nacional, error compartido",
  "The part of a forecast miss that hits every race in the same direction. When polls underestimate one party, they usually do it everywhere at once. In the model this shared miss is about ±2.9 points on each race margin.": "La parte del error de un pronóstico que afecta a todas las carreras en la misma dirección. Cuando las encuestas infravaloran a un partido, suelen hacerlo en todas partes a la vez. En el modelo, este error compartido es de unos ±2,9 puntos en el margen de cada carrera.",
  "It is why races are not independent coin flips: a bad night for Democrats in Ohio usually means a bad night in Maine too.": "Por eso las carreras no son lanzamientos de moneda independientes: una mala noche para los demócratas en Ohio suele significar también una mala noche en Maine.",
  // Generic ballot ("Generic ballot" itself lives in live.ts)
  "A national poll question: \"If the election for Congress were held today, would you vote for the Democratic or the Republican candidate in your district?\" It measures the overall political mood, not any single race.": "Una pregunta de las encuestas nacionales: «Si las elecciones al Congreso se celebraran hoy, ¿votaría al candidato demócrata o al republicano de su distrito?». Mide el ambiente político general, no una carrera concreta.",
  "D+4.4 means Democrats lead the average of these polls by 4.4 points.": "D+4.4 significa que los demócratas encabezan la media de estas encuestas por 4,4 puntos.",
  // House majority
  "House majority": "Mayoría en la Cámara",
  "Control of the House of Representatives needs 218 of 435 seats. Every seat is elected every two years.": "Controlar la Cámara de Representantes exige 218 de los 435 escaños. Todos los escaños se eligen cada dos años.",
  // Incumbent
  "The person, or party, currently holding the seat. An open seat is one where the incumbent is not running.": "La persona, o el partido, que ocupa actualmente el escaño. Un escaño abierto es aquel en el que el titular no se presenta.",
  // Likely voters
  "Likely voters (LV)": "Votantes probables (LV)",
  "registered voters (RV), adults (A)": "votantes registrados (RV), adultos (A)",
  "Who a poll interviewed. Likely voters are screened for how probable it is that they vote; registered voters are on the rolls; adults is everyone. Likely-voter polls get the most weight because they are closest to the real electorate.": "A quién entrevistó una encuesta. A los votantes probables se les filtra según la probabilidad de que voten; los votantes registrados están en el censo electoral; los adultos son todo el mundo. Las encuestas de votantes probables reciben el mayor peso porque son las más cercanas al electorado real.",
  "Weights: LV 1.00 · RV 0.86 · adults 0.72.": "Pesos: LV 1,00 · RV 0,86 · adultos 0,72.",
  // Local error
  "Local error": "Error local",
  "The part of a forecast miss that belongs to one race only: a strong candidate, a scandal, a local issue. It is large for a single race (about ±9.6 points) but it cancels out across hundreds of races.": "La parte del error de un pronóstico que pertenece a una sola carrera: un candidato fuerte, un escándalo, un asunto local. Es grande en una carrera concreta (unos ±9,6 puntos), pero se compensa entre cientos de carreras.",
  // Margin
  "D+4.4, R+2.0": "D+4.4, R+2.0",
  "How far one party leads the other, in percentage points. D+4.4 means Democrats ahead by 4.4 points; R+2.0 means Republicans ahead by 2.0.": "Cuánta ventaja saca un partido al otro, en puntos porcentuales. D+4.4 significa demócratas por delante por 4,4 puntos; R+2.0, republicanos por delante por 2,0.",
  "49.3% D vs 44.9% R is a margin of D+4.4.": "49,3% D frente a 44,9% R es un margen de D+4.4.",
  // Median seats
  "Median seats": "Mediana de escaños",
  "The middle outcome of the 50,000 simulations: half of the runs give a party more seats than this, half give it fewer. It is the model's single best guess for the seat count.": "El resultado central de las 50.000 simulaciones: la mitad dan a un partido más escaños que esta cifra y la otra mitad, menos. Es la mejor estimación única del modelo para el número de escaños.",
  // Midterm
  "Midterm election": "Elecciones de mitad de mandato",
  "The U.S. election held halfway through a presidential term. All 435 House seats and about a third of the Senate are on the ballot. The 2026 midterms are on Tuesday, November 3, 2026.": "Las elecciones de EE. UU. que se celebran a mitad de un mandato presidencial. Se votan los 435 escaños de la Cámara y alrededor de un tercio del Senado. Las de 2026 son el martes 3 de noviembre de 2026.",
  // Movement
  "How much the national poll average has changed since the benchmark was published. Each race is shifted by 70% of it, so the forecast stays current between benchmark updates.": "Cuánto ha cambiado la media nacional de encuestas desde que se publicó la referencia. Cada carrera se desplaza un 70% de ese cambio, para que el pronóstico siga al día entre actualizaciones de la referencia.",
  "If polls moved D+2 since the benchmark, every race margin moves D+1.4.": "Si las encuestas se han movido D+2 desde la referencia, el margen de cada carrera se mueve D+1.4.",
  // MP-26
  "MP-26": "MP-26",
  "Midterm Pulse 2026, the forecast model behind this site. It starts from a race-by-race benchmark, updates it with the national polls, and simulates the election 50,000 times. The current version is v0.4; it is experimental and not yet backtested.": "Midterm Pulse 2026, el modelo de pronóstico detrás de esta web. Parte de una referencia carrera a carrera, la actualiza con las encuestas nacionales y simula las elecciones 50.000 veces. La versión actual es la v0.4; es experimental y aún no tiene backtesting.",
  // Nationalization
  "Nationalization": "Nacionalización",
  "How much a race follows the national mood rather than local factors. The model assumes 70%: when the country moves 1 point, a typical race moves 0.7.": "Hasta qué punto una carrera sigue el ambiente nacional en lugar de factores locales. El modelo supone un 70%: cuando el país se mueve 1 punto, una carrera típica se mueve 0,7.",
  // Poll weight
  "Poll weight": "Peso de una encuesta",
  "How much one poll counts in the average. Newer polls count more (weight halves every 30 days), bigger samples count more, and likely-voter polls count more than polls of all adults.": "Cuánto cuenta una encuesta en la media. Las más recientes cuentan más (el peso se reduce a la mitad cada 30 días), las muestras más grandes cuentan más y las de votantes probables cuentan más que las de todos los adultos.",
  // Prediction market
  "A market where people bet on outcomes, such as Polymarket. A price of 62¢ on \"Democrats win\" reads as a 62% chance. The site shows markets next to the model for comparison; they never feed into it.": "Un mercado en el que se apuesta por resultados, como Polymarket. Un precio de 62¢ en «ganan los demócratas» se lee como un 62% de probabilidad. La web muestra los mercados junto al modelo para compararlos; nunca lo alimentan.",
  // Race rating
  "Race rating": "Calificación de la carrera",
  "Safe, Likely, Lean, Toss-up": "Segura, Probable, Inclinada, Toss-up",
  "A plain-word summary of how competitive a race is. Safe: not competitive. Likely: clear favourite. Lean: favourite, but an upset is realistic. Toss-up: either side can win.": "Un resumen en palabras sencillas de lo competida que está una carrera. Segura: no es competitiva. Probable: hay un favorito claro. Inclinada: hay favorito, pero una sorpresa es realista. Toss-up: puede ganar cualquiera.",
  // Seats not up
  "Seats not up": "Escaños que no se renuevan",
  "Senate seats that are not on the ballot this year, because senators serve six-year terms. In 2026, 34 Democratic and 31 Republican seats are not up, so they are fixed in every simulation.": "Escaños del Senado que no se votan este año, porque los senadores tienen mandatos de seis años. En 2026, 34 escaños demócratas y 31 republicanos no se renuevan, así que son fijos en todas las simulaciones.",
  // Senate control
  "Democrats need 51 of 100 seats. At 50–50 the Vice President, a Republican, breaks ties, so Republicans keep control.": "Los demócratas necesitan 51 de los 100 escaños. Con un 50–50, el vicepresidente, republicano, deshace los empates, así que los republicanos mantienen el control.",
  // Simulation ("Simulation" itself lives in explainer.ts)
  "Playing the election many times with random but realistic errors, then counting how often each outcome happens. The model runs 50,000 elections per chamber; a 99% chance means one party won in 99 of every 100 runs.": "Celebrar las elecciones muchas veces con errores aleatorios pero realistas y contar con qué frecuencia se da cada resultado. El modelo simula 50.000 elecciones por cámara; un 99% de probabilidad significa que un partido ganó en 99 de cada 100 simulaciones.",
  // Special election
  "An election to fill a seat that became vacant before the end of its term, for example after a resignation or death. It can put a state's second Senate seat on the ballot.": "Una elección para cubrir un escaño que quedó vacante antes de terminar su mandato, por ejemplo tras una dimisión o un fallecimiento. Puede hacer que se vote el segundo escaño de un estado en el Senado.",
  // Swing
  "Swing": "Giro",
  "national swing": "giro nacional",
  "A hypothetical shift in the national vote applied to every race at once. The swing slider on the home page lets you ask \"what if the country moved 3 points toward Republicans?\"": "Un desplazamiento hipotético del voto nacional aplicado a todas las carreras a la vez. El control de giro de la portada te permite preguntar «¿y si el país se moviera 3 puntos hacia los republicanos?».",
  // Tipping point (term itself lives in explainer.ts)
  "Line up all 435 districts from most Democratic to most Republican. The 218th is the tipping point: whichever party wins it also wins every seat on its side of the line, and with them the majority.": "Ordena los 435 distritos del más demócrata al más republicano. El 218.º es el escaño decisivo: el partido que lo gane gana también todos los escaños de su lado de la línea y, con ellos, la mayoría.",
  "If the tipping point is D+7.7, Republicans need to win districts where they trail by 7.7 points, which only happens if the whole country moves toward them at once.": "Si el escaño decisivo está en D+7.7, los republicanos necesitan ganar distritos en los que van 7,7 puntos por detrás, algo que solo ocurre si todo el país se mueve hacia ellos a la vez.",
  // Two-party vote
  "Two-party vote": "Voto a dos partidos",
  "The projected vote share of the Democratic and the Republican candidate. Usually they add up to nearly 100; where a strong independent or third-party candidate is running, they add up to much less.": "El porcentaje de voto proyectado del candidato demócrata y del republicano. Normalmente suman casi 100; donde se presenta un independiente o un tercer partido fuerte, suman bastante menos.",
  // Win probability
  "How often a candidate wins across the 50,000 simulations. 78% does not mean a landslide: it means the candidate loses roughly 1 time in 5.": "Con qué frecuencia gana un candidato en las 50.000 simulaciones. Un 78% no significa una victoria aplastante: significa que el candidato pierde aproximadamente 1 de cada 5 veces.",
};
