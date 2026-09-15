// Resultados guardados del triaje, generados con IA para reproducir la demo sin
// llamar al modelo. Siguen el mismo esquema JSON que devuelve el modelo.
// Formato compacto: cada criterio es [regla, resultado, evidencia]; la
// descripción de la regla se toma de REGLA_DESC. `tok` = [entrada, salida, razonamiento].

const REGLA_DESC = {
  A1: 'Póliza vigente y al corriente de pago en la fecha del hecho',
  A2: 'Comunicación en plazo (7 días, art. 16 LCS)',
  A3: 'Conductor declarado en la póliza',
  A4: 'Sin alcohol, drogas, fuga ni uso no declarado',
  A5: 'Terceros documentados y sin lesionados',
  A6: 'Importe inferior a 6.000 € y proporcionado',
  A7: 'Supuesto de despeje directo con documentación',
  A8: 'Coherencia del relato y siniestralidad',
  H1: 'Póliza vigente en la fecha del hecho',
  H2: 'Comunicación en plazo (7 días desde que se conoce el daño)',
  H3: 'Daño por agua súbito, no filtración ni falta de mantenimiento',
  H4: 'Robo con fuerza, denuncia y dentro de límites',
  H5: 'Despeje directo: cristales, sanitarios, eléctrico < 1.500 €',
  H6: 'Vandalismo / atmosférico con denuncia o fecha verificable, < 10.000 €',
  H7: 'Póliza reciente (< 30 días) con siniestro > 3.000 €',
  H8: 'Vivienda deshabitada más de 30 días',
  H9: 'Importe inferior a 10.000 €',
  S1: 'Asegurado activo en la póliza',
  S2: 'Fuera de periodo de carencia',
  S3: 'Sin preexistencias no declaradas',
  S4: 'Autorización previa cuando procede',
  S5: 'Centro del cuadro médico o modalidad de reembolso',
  S6: 'Despeje directo: urgencias, consultas y pruebas básicas en cuadro',
  S7: 'Reembolso ≤ 2.000 € y prestación cubierta',
  S8: 'No corresponde a seguro de auto ni a mutua laboral',
};

const RESULTADOS_GUARDADOS = {
  // ───────────────────────── Paquete A ─────────────────────────
  'MSG-A-01': {
    ramo: 'Auto', cr: ['Daño en un vehículo: Seat León 4521 KLM', 'Póliza con prefijo AU-483920', 'Colisión por alcance en la M-30 con parte amistoso'],
    d: { nombre_cliente: 'Marta Gil Sanz', numero_poliza: 'AU-483920', tipo_siniestro: 'Colisión por alcance en retención', fecha_hecho: '2026-09-12', importe_estimado_eur: 1350, lugar: 'M-30, Madrid', terceros_implicados: true, lesionados: false, documentacion_mencionada: ['parte amistoso escaneado', 'presupuesto de taller'], observaciones: 'Daños en paragolpes y faro derecho; la asegurada reconoce haber golpeado por detrás.' },
    c: [['A1', 'cumple', 'No hay mención de impago ni baja; póliza AU-483920 identificada'], ['A2', 'cumple', 'Hecho el 12/09, comunicado el 14/09 (2 días)'], ['A3', 'cumple', 'Conducía la propia tomadora ("iba por la M-30")'], ['A4', 'cumple', 'Sin indicios de alcohol, drogas ni fuga'], ['A5', 'cumple', 'Tercero implicado con parte amistoso firmado por ambos; "No hubo heridos"'], ['A6', 'cumple', '1.350 € < 6.000 €'], ['A7', 'cumple', 'Colisión simple sin heridos, parte amistoso y presupuesto adjuntos'], ['A8', 'cumple', 'Relato coherente con los daños (paragolpes y faro)']],
    dec: 'DESPEJADO', motivo: 'Colisión leve con parte amistoso, sin heridos y presupuesto de 1.350 €: cumple todas las reglas del ramo Auto.', conf: 0.95, tok: [1384, 612, 214],
  },
  'MSG-A-02': {
    ramo: 'Hogar', cr: ['Daño en la vivienda: fregadero, salón, tarima', 'Póliza de hogar HO-220114', 'Rotura de latiguillo y daños por agua'],
    d: { nombre_cliente: 'Jorge Herrera Pino', numero_poliza: 'HO-220114', tipo_siniestro: 'Daños por agua por rotura de latiguillo', fecha_hecho: '2026-09-13', importe_estimado_eur: 1080, lugar: 'C/ Alcalá 210, Madrid', terceros_implicados: false, lesionados: false, documentacion_mencionada: ['fotos', 'factura del fontanero (180 €)', 'presupuesto de parquetista (900 €)'], observaciones: 'Importe = 180 € fontanería de urgencia + 900 € reposición de 6 m² de tarima.' },
    c: [['H1', 'cumple', 'Póliza HO-220114 identificada; sin mención de impago'], ['H2', 'cumple', 'Hecho el 13/09, comunicado el 14/09'], ['H3', 'cumple', 'Rotura súbita del latiguillo de agua fría; no es filtración progresiva'], ['H4', 'no_aplica', 'No es un robo'], ['H5', 'no_aplica', 'No es cristal, sanitario ni daño eléctrico'], ['H6', 'no_aplica', 'No es vandalismo ni fenómeno atmosférico'], ['H7', 'no_aplica', 'No consta la antigüedad de la póliza; importe < 3.000 €'], ['H8', 'no_aplica', 'Vivienda habitada'], ['H9', 'cumple', '1.080 € < 10.000 €']],
    dec: 'DESPEJADO', motivo: 'Daño por agua súbito por rotura de latiguillo, comunicado al día siguiente con facturas y fotos; importe 1.080 €.', conf: 0.94, tok: [1391, 598, 196],
  },
  'MSG-A-03': {
    ramo: 'Salud', cr: ['Prestación sanitaria: urgencias por esguince', 'Hospital Quirón Pozuelo "en el cuadro médico"', 'Tarjeta sanitaria 7712 0034 8891'],
    d: { nombre_cliente: 'Lucía Fernández Ruiz', numero_poliza: null, tipo_siniestro: 'Urgencias por esguince de tobillo', fecha_hecho: '2026-09-14', importe_estimado_eur: null, lugar: 'Hospital Quirón Pozuelo', terceros_implicados: false, lesionados: true, documentacion_mencionada: ['tarjeta sanitaria'], observaciones: 'Radiografía y férula en urgencias; no indica número de póliza, solo tarjeta.' },
    c: [['S1', 'cumple', 'Se identifica con tarjeta 7712 0034 8891'], ['S2', 'cumple', 'Urgencia por traumatismo: sin carencia'], ['S3', 'cumple', 'Lesión aguda practicando deporte'], ['S4', 'cumple', 'Urgencias y radiografía no requieren autorización'], ['S5', 'cumple', 'Centro del cuadro médico'], ['S6', 'cumple', 'Urgencias en centro del cuadro'], ['S7', 'no_aplica', 'No hay reembolso'], ['S8', 'cumple', 'Lesión deportiva, no laboral ni de tráfico']],
    dec: 'DESPEJADO', motivo: 'Urgencias por esguince en hospital del cuadro médico: prestación directa sin carencia ni autorización.', conf: 0.93, tok: [1360, 571, 188],
  },
  'MSG-A-04': {
    ramo: 'Auto', cr: ['Daño en vehículo: Peugeot 308', 'Póliza AU-119045', 'Roce contra columna al salir de un parking'],
    d: { nombre_cliente: 'Antonio Navarro Blanco', numero_poliza: 'AU-119045', tipo_siniestro: 'Daños propios por roce contra columna', fecha_hecho: '2026-09-10', importe_estimado_eur: 2200, lugar: 'Parking de la universidad', terceros_implicados: false, lesionados: false, documentacion_mencionada: ['presupuesto de taller de confianza'], observaciones: 'Conducía el hijo del tomador, Pablo, de 22 años.' },
    c: [['A1', 'cumple', 'Póliza AU-119045; sin mención de impago'], ['A2', 'cumple', 'Hecho el jueves 10/09, comunicado el 13/09'], ['A3', 'incumple', '"mi hijo Pablo (tiene 22 años) cogió mi coche": conductor no declarado en la póliza'], ['A4', 'cumple', 'Sin indicios de alcohol, drogas ni fuga'], ['A5', 'cumple', 'Sin terceros ni lesionados'], ['A6', 'cumple', '2.200 € < 6.000 €'], ['A7', 'no_aplica', 'Daños propios, pero el conductor no declarado impide el despeje directo'], ['A8', 'cumple', 'Relato coherente']],
    dec: 'REVISION', motivo: 'Conducía el hijo del tomador (22 años), no consta como conductor declarado: comprobar conductores habituales y condiciones de la póliza antes de tramitar.', conf: 0.9, tok: [1388, 634, 241],
  },
  'MSG-A-05': {
    ramo: 'Hogar', cr: ['Daño en contenido de la vivienda: televisor y router', 'Póliza HO-334902', 'Subida de tensión en la urbanización'],
    d: { nombre_cliente: 'Elena Torres Vidal', numero_poliza: 'HO-334902', tipo_siniestro: 'Daños eléctricos por sobretensión', fecha_hecho: '2026-09-11', importe_estimado_eur: 640, lugar: null, terceros_implicados: false, lesionados: false, documentacion_mencionada: ['informe de incidencia de la compañía eléctrica'], observaciones: 'Servicio técnico indica que la placa del televisor no tiene reparación.' },
    c: [['H1', 'cumple', 'Póliza HO-334902; sin mención de impago'], ['H2', 'cumple', 'Hecho el 11/09, comunicado el 12/09'], ['H3', 'no_aplica', 'No es daño por agua'], ['H4', 'no_aplica', 'No es robo'], ['H5', 'cumple', 'Daño eléctrico por sobretensión con informe técnico y 640 € < 1.500 €'], ['H6', 'no_aplica', 'No es vandalismo ni fenómeno atmosférico'], ['H7', 'no_aplica', 'Importe < 3.000 €'], ['H8', 'no_aplica', 'Vivienda habitada'], ['H9', 'cumple', '640 € < 10.000 €']],
    dec: 'DESPEJADO', motivo: 'Daño eléctrico por sobretensión reconocida por la compañía, con informe y 640 €: supuesto de despeje directo.', conf: 0.95, tok: [1372, 580, 175],
  },
  'MSG-A-06': {
    ramo: 'Salud', cr: ['Solicitud de pruebas diagnósticas prescritas', 'Traumatólogo del cuadro médico (Dr. Ibáñez, Clínica Santa Elena)', 'Póliza SA-770213'],
    d: { nombre_cliente: 'Sergio Vega Ramos', numero_poliza: 'SA-770213', tipo_siniestro: 'Radiografía lumbar y analítica prescritas', fecha_hecho: '2026-09-08', importe_estimado_eur: null, lugar: 'Clínica Santa Elena', terceros_implicados: false, lesionados: true, documentacion_mencionada: [], observaciones: 'Caída en casa el día 8; consulta si necesita trámite para las pruebas.' },
    c: [['S1', 'cumple', 'Póliza SA-770213 identificada'], ['S2', 'cumple', 'Pruebas básicas sin carencia'], ['S3', 'cumple', 'Lesión aguda por caída'], ['S4', 'cumple', 'Radiografía y analítica no requieren autorización previa'], ['S5', 'cumple', 'Prescripción de médico del cuadro'], ['S6', 'cumple', 'Pruebas básicas en el cuadro médico'], ['S7', 'no_aplica', 'No hay reembolso'], ['S8', 'cumple', 'Caída doméstica, no laboral ni de tráfico']],
    dec: 'DESPEJADO', motivo: 'Radiografía y analítica prescritas por traumatólogo del cuadro: pruebas básicas sin autorización previa.', conf: 0.92, tok: [1358, 566, 182],
  },
  'MSG-A-07': {
    ramo: 'Auto', cr: ['Daño en vehículo: parabrisas del Toyota Corolla 8834 LPT', 'Póliza AU-905512', 'Taller de lunas concertado'],
    d: { nombre_cliente: 'Paula Jiménez Mora', numero_poliza: 'AU-905512', tipo_siniestro: 'Rotura de luna por impacto de gravilla', fecha_hecho: '2026-09-14', importe_estimado_eur: 280, lugar: 'Autovía A-2', terceros_implicados: false, lesionados: false, documentacion_mencionada: ['presupuesto del taller de lunas concertado'], observaciones: 'Grieta en extensión; sustitución en taller concertado.' },
    c: [['A1', 'cumple', 'Póliza AU-905512; sin mención de impago'], ['A2', 'cumple', 'Hecho y comunicado el 14/09'], ['A3', 'cumple', 'Conducía la tomadora'], ['A4', 'cumple', 'Sin indicios'], ['A5', 'cumple', 'Sin terceros identificables ni lesionados'], ['A6', 'cumple', '280 € < 6.000 €'], ['A7', 'cumple', 'Rotura de luna con presupuesto de taller concertado'], ['A8', 'cumple', 'Relato coherente']],
    dec: 'DESPEJADO', motivo: 'Rotura de luna por gravilla, 280 € en taller concertado: despeje directo.', conf: 0.97, tok: [1349, 548, 160],
  },
  'MSG-A-08': {
    ramo: 'Auto', cr: ['Accidente de circulación de una moto (Honda CB500)', 'Póliza AU-662371', 'También menciona seguro de salud SA-662371 y hospitalización: el hecho causante es el accidente de tráfico, ramo principal Auto'],
    d: { nombre_cliente: 'Carlos Ortega (comunica su esposa, Rosa Molina Serrano)', numero_poliza: 'AU-662371', tipo_siniestro: 'Accidente de moto con tercero y lesiones', fecha_hecho: '2026-09-14', importe_estimado_eur: null, lugar: 'Rotonda en Alcorcón', terceros_implicados: true, lesionados: true, documentacion_mencionada: ['atestado de la Guardia Civil'], observaciones: 'Asegurado ingresado en el Hospital Fundación Alcorcón (fractura de clavícula y dos costillas); moto en el depósito; el otro conductor permaneció en el lugar.' },
    c: [['A1', 'cumple', 'Póliza AU-662371; sin mención de impago'], ['A2', 'cumple', 'Hecho y comunicado el 14/09'], ['A3', 'cumple', 'Conducía el asegurado'], ['A4', 'cumple', 'Sin indicios; el tercero se quedó en el lugar'], ['A5', 'incumple', 'Tercero implicado con atestado, pero hay lesionado ingresado: gestión de daños corporales'], ['A6', 'no_aplica', 'Importe no indicado; moto "bastante destrozada", posible siniestro total'], ['A7', 'no_aplica', 'No es supuesto de despeje directo por existir lesiones'], ['A8', 'cumple', 'Relato coherente']],
    dec: 'REVISION', motivo: 'Accidente de moto con lesionado ingresado y tercero implicado: gestión especializada de daños corporales y coordinación con la póliza de salud SA-662371.', conf: 0.9, tok: [1412, 668, 262],
  },
  'MSG-A-09': {
    ramo: 'Hogar', cr: ['Daño en la vivienda: cristal de la ventana del salón', 'Póliza de hogar HO-118830', 'Rotura por balón de los hijos del vecino'],
    d: { nombre_cliente: 'Iván Castro Luque', numero_poliza: 'HO-118830', tipo_siniestro: 'Rotura de cristal', fecha_hecho: '2026-09-13', importe_estimado_eur: 400, lugar: null, terceros_implicados: true, lesionados: false, documentacion_mencionada: ['foto', 'presupuesto del cristalero'], observaciones: 'Causado por los hijos del vecino: posible recobro al responsable civil.' },
    c: [['H1', 'cumple', 'Póliza HO-118830 identificada'], ['H2', 'cumple', 'Hecho y comunicado el 13/09'], ['H3', 'no_aplica', 'No es daño por agua'], ['H4', 'no_aplica', 'No es robo'], ['H5', 'cumple', 'Rotura de cristal de 400 € < 1.500 € con foto y presupuesto'], ['H6', 'no_aplica', 'No es vandalismo'], ['H7', 'no_aplica', 'Importe < 3.000 €'], ['H8', 'no_aplica', 'Vivienda habitada'], ['H9', 'cumple', '400 € < 10.000 €']],
    dec: 'DESPEJADO', motivo: 'Rotura de cristal de 400 € con foto y presupuesto: despeje directo; anotar posible recobro al vecino.', conf: 0.93, tok: [1355, 584, 190],
  },
  'MSG-A-10': {
    ramo: 'Salud', cr: ['Prestación sanitaria: urgencias por crisis de asma', 'Hospital Universitario Quirónsalud Madrid "en el cuadro médico"', 'Póliza SA-337700'],
    d: { nombre_cliente: 'Clara Ramos Ortiz', numero_poliza: 'SA-337700', tipo_siniestro: 'Urgencias por crisis de asma', fecha_hecho: '2026-09-10', importe_estimado_eur: null, lugar: 'Hospital Universitario Quirónsalud Madrid', terceros_implicados: false, lesionados: false, documentacion_mencionada: ['informe de urgencias'], observaciones: 'Nebulizaciones y corticoides; alta de madrugada.' },
    c: [['S1', 'cumple', 'Póliza SA-337700 identificada'], ['S2', 'cumple', 'Urgencia vital sin carencia'], ['S3', 'cumple', 'No consta que el asma sea preexistencia no declarada; urgencia cubierta en todo caso'], ['S4', 'cumple', 'Urgencias no requieren autorización'], ['S5', 'cumple', 'Centro del cuadro médico'], ['S6', 'cumple', 'Urgencias en centro del cuadro con informe'], ['S7', 'no_aplica', 'No hay reembolso'], ['S8', 'cumple', 'No es tráfico ni laboral']],
    dec: 'DESPEJADO', motivo: 'Urgencias por crisis de asma en hospital del cuadro con informe adjunto: prestación directa sin carencia.', conf: 0.94, tok: [1352, 562, 178],
  },

  // ───────────────────────── Paquete B ─────────────────────────
  'MSG-B-01': {
    ramo: 'Auto', cr: ['Daño en vehículo: Renault Clio 5567 JKD', 'Póliza AU-201188', 'Colisión en parking con parte amistoso'],
    d: { nombre_cliente: 'Daniel Romero Sáez', numero_poliza: 'AU-201188', tipo_siniestro: 'Colisión en parking (aleta delantera)', fecha_hecho: '2026-09-13', importe_estimado_eur: 900, lugar: 'Parking del Mercadona de Getafe', terceros_implicados: true, lesionados: false, documentacion_mencionada: ['parte amistoso', 'fotos'], observaciones: 'La otra conductora reconoce la culpa.' },
    c: [['A1', 'cumple', 'Póliza AU-201188; sin mención de impago'], ['A2', 'cumple', 'Hecho el 13/09, comunicado el 14/09'], ['A3', 'cumple', 'Conducía el tomador'], ['A4', 'cumple', 'Sin indicios'], ['A5', 'cumple', 'Tercero con parte amistoso firmado; sin heridos'], ['A6', 'cumple', '900 € < 6.000 €'], ['A7', 'cumple', 'Colisión simple con parte amistoso y fotos'], ['A8', 'cumple', 'Relato coherente']],
    dec: 'DESPEJADO', motivo: 'Roce en parking con parte amistoso, culpa reconocida por el tercero y 900 €: despeje directo.', conf: 0.96, tok: [1370, 590, 185],
  },
  'MSG-B-02': {
    ramo: 'Hogar', cr: ['Daño en la vivienda: pared del baño y dormitorio', 'Póliza HO-556701', 'Humedad y pintura abombada'],
    d: { nombre_cliente: 'Carmen Díaz Peña', numero_poliza: 'HO-556701', tipo_siniestro: 'Humedad progresiva en pared del baño', fecha_hecho: null, importe_estimado_eur: null, lugar: null, terceros_implicados: false, lesionados: false, documentacion_mencionada: [], observaciones: 'La mancha "ha ido apareciendo desde hace unos meses"; la cliente atribuye el origen a la silicona vieja de la junta de la bañera.' },
    c: [['H1', 'cumple', 'Póliza HO-556701; sin mención de impago'], ['H2', 'incumple', '"desde hace unos meses... cada vez más grande": comunicación muy posterior al conocimiento del daño'], ['H3', 'incumple', 'Filtración progresiva por junta/silicona deteriorada: falta de mantenimiento, no daño súbito'], ['H4', 'no_aplica', 'No es robo'], ['H5', 'no_aplica', 'No es cristal ni eléctrico'], ['H6', 'no_aplica', 'No es vandalismo ni atmosférico'], ['H7', 'no_aplica', 'Sin importe'], ['H8', 'no_aplica', 'Vivienda habitada'], ['H9', 'no_aplica', 'Sin importe estimado']],
    dec: 'REVISION', motivo: 'Humedad progresiva de meses por silicona deteriorada: comunicación fuera de plazo y probable exclusión por falta de mantenimiento; requiere peritación.', conf: 0.91, tok: [1366, 640, 248],
  },
  'MSG-B-03': {
    ramo: 'Salud', cr: ['Prestación sanitaria: urgencias pediátricas', 'Hospital Vithas Madrid', 'Póliza familiar SA-401277 con la hija incluida'],
    d: { nombre_cliente: 'Aitana López Bravo (por su hija Vera, 3 años)', numero_poliza: 'SA-401277', tipo_siniestro: 'Urgencias pediátricas por fiebre y vómitos', fecha_hecho: '2026-09-13', importe_estimado_eur: null, lugar: 'Hospital Vithas Madrid', terceros_implicados: false, lesionados: false, documentacion_mencionada: [], observaciones: 'Analítica en urgencias; alta el mismo día.' },
    c: [['S1', 'cumple', 'La hija está "incluida en la póliza familiar SA-401277"'], ['S2', 'cumple', 'Urgencia sin carencia'], ['S3', 'cumple', 'Proceso agudo'], ['S4', 'cumple', 'Urgencias y analítica no requieren autorización'], ['S5', 'cumple', 'Hospital Vithas, centro habitual del cuadro'], ['S6', 'cumple', 'Urgencias con analítica básica'], ['S7', 'no_aplica', 'No hay reembolso'], ['S8', 'cumple', 'No es tráfico ni laboral']],
    dec: 'DESPEJADO', motivo: 'Urgencias pediátricas de beneficiaria incluida en póliza familiar: prestación directa.', conf: 0.92, tok: [1348, 558, 172],
  },
  'MSG-B-04': {
    ramo: 'Auto', cr: ['Daño en vehículo: retrovisor del Kia Ceed 3390 KTR', 'Póliza AU-778201 con daños propios', 'Denuncia por tercero que se dio a la fuga'],
    d: { nombre_cliente: 'Hugo Sánchez Prieto', numero_poliza: 'AU-778201', tipo_siniestro: 'Retrovisor arrancado por vehículo desconocido', fecha_hecho: '2026-09-14', importe_estimado_eur: 350, lugar: 'Calle Bravo Murillo, Madrid', terceros_implicados: true, lesionados: false, documentacion_mencionada: ['denuncia en comisaría'], observaciones: 'Tercero no identificado; vehículo estacionado.' },
    c: [['A1', 'cumple', 'Póliza AU-778201; sin mención de impago'], ['A2', 'cumple', 'Hecho esa noche, comunicado el 14/09'], ['A3', 'no_aplica', 'Vehículo estacionado, nadie conducía'], ['A4', 'cumple', 'La fuga es del tercero desconocido, no del asegurado'], ['A5', 'cumple', 'Tercero no identificable; denuncia presentada; sin heridos'], ['A6', 'cumple', '350 € < 6.000 €'], ['A7', 'cumple', 'Daños con denuncia y cobertura de daños propios'], ['A8', 'cumple', 'Relato coherente']],
    dec: 'DESPEJADO', motivo: 'Retrovisor dañado por tercero desconocido, con denuncia y 350 € en póliza con daños propios: despeje directo.', conf: 0.93, tok: [1362, 596, 201],
  },
  'MSG-B-05': {
    ramo: 'Hogar', cr: ['Robo en la vivienda con cerradura forzada', 'Póliza HO-902213', 'Sustracción de portátil y televisión'],
    d: { nombre_cliente: 'Noa Blanco Rey', numero_poliza: 'HO-902213', tipo_siniestro: 'Robo con fuerza en vivienda', fecha_hecho: '2026-09-12', importe_estimado_eur: 1990, lugar: null, terceros_implicados: false, lesionados: false, documentacion_mencionada: ['denuncia en Policía Nacional', 'factura del portátil (1.150 €)', 'factura de cambio de cerradura (190 €)'], observaciones: 'Importe = 1.150 € portátil + 650 € televisión + 190 € cerradura. Ausencia por vacaciones sin indicar duración.' },
    c: [['H1', 'cumple', 'Póliza HO-902213; sin mención de impago'], ['H2', 'cumple', 'Descubierto el 12/09, comunicado el 13/09'], ['H3', 'no_aplica', 'No es daño por agua'], ['H4', 'cumple', 'Cerradura reventada (fuerza), denuncia el mismo día, sin joyas ni efectivo'], ['H5', 'no_aplica', 'No es cristal ni eléctrico'], ['H6', 'no_aplica', 'No es vandalismo ni atmosférico'], ['H7', 'no_aplica', 'Importe < 3.000 €'], ['H8', 'no_aplica', 'Ausencia por vacaciones; no consta que supere 30 días'], ['H9', 'cumple', '1.990 € < 10.000 €']],
    dec: 'DESPEJADO', motivo: 'Robo con fuerza acreditada, denuncia y facturas, 1.990 € sin joyas ni efectivo: cumple las reglas de Hogar.', conf: 0.93, tok: [1398, 622, 220],
  },
  'MSG-B-06': {
    ramo: 'Salud', cr: ['Solicitud de reembolso de una cirugía', 'Seguro de salud SA-885120', 'Clínica Rotger, no incluida en el cuadro'],
    d: { nombre_cliente: 'Álvaro Serrano Cano', numero_poliza: 'SA-885120', tipo_siniestro: 'Reembolso de cirugía de menisco', fecha_hecho: '2026-09-04', importe_estimado_eur: 4800, lugar: 'Clínica Rotger, Palma', terceros_implicados: false, lesionados: true, documentacion_mencionada: ['factura de 4.800 €'], observaciones: 'Póliza contratada en julio de 2026; la lesión "la arrastraba de hace un par de años".' },
    c: [['S1', 'cumple', 'Póliza SA-885120 identificada'], ['S2', 'incumple', 'Cirugía programada el 04/09 con póliza de julio de 2026: dentro de la carencia de 6 meses'], ['S3', 'incumple', 'Lesión de "hace un par de años", anterior a la contratación'], ['S4', 'incumple', 'Cirugía ya realizada sin autorización previa'], ['S5', 'incumple', 'Centro "no está en vuestro cuadro" y no consta modalidad de reembolso'], ['S6', 'no_aplica', 'No es prestación básica en cuadro'], ['S7', 'incumple', 'Reembolso de 4.800 € > 2.000 €'], ['S8', 'cumple', 'No es tráfico ni laboral']],
    dec: 'REVISION', motivo: 'Cirugía programada dentro de carencia, lesión preexistente, sin autorización previa y en centro fuera del cuadro: el reembolso de 4.800 € no procede sin revisión.', conf: 0.96, tok: [1402, 672, 270],
  },
  'MSG-B-07': {
    ramo: 'Auto', cr: ['Daño en vehículo: Fiat 500 9921 LLB', 'Póliza AU-540098 a todo riesgo con franquicia', 'Golpe contra bolardo al aparcar'],
    d: { nombre_cliente: 'Irene Castro Mena', numero_poliza: 'AU-540098', tipo_siniestro: 'Daños propios por golpe contra bolardo', fecha_hecho: '2026-09-14', importe_estimado_eur: 1100, lugar: 'Calle de la asegurada', terceros_implicados: false, lesionados: false, documentacion_mencionada: ['fotos', 'presupuesto de taller'], observaciones: 'Aplicar franquicia de la póliza.' },
    c: [['A1', 'cumple', 'Póliza AU-540098; sin mención de impago'], ['A2', 'cumple', 'Hecho y comunicado el 14/09'], ['A3', 'cumple', 'Conducía la tomadora'], ['A4', 'cumple', 'Sin indicios'], ['A5', 'cumple', 'Sin terceros ni lesionados'], ['A6', 'cumple', '1.100 € < 6.000 €'], ['A7', 'cumple', 'Daños propios sin terceros con fotos y presupuesto'], ['A8', 'cumple', 'Relato coherente']],
    dec: 'DESPEJADO', motivo: 'Daños propios contra bolardo, 1.100 € con fotos en póliza a todo riesgo: despeje directo aplicando franquicia.', conf: 0.95, tok: [1358, 574, 176],
  },
  'MSG-B-08': {
    ramo: 'Hogar', cr: ['Daño en la vivienda: mampara de ducha', 'Póliza hogar HO-661540'],
    d: { nombre_cliente: 'Pablo Navarro Gil', numero_poliza: 'HO-661540', tipo_siniestro: 'Rotura de mampara de ducha', fecha_hecho: '2026-09-12', importe_estimado_eur: 320, lugar: null, terceros_implicados: false, lesionados: false, documentacion_mencionada: ['foto', 'presupuesto de reposición'], observaciones: null },
    c: [['H1', 'cumple', 'Póliza HO-661540 identificada'], ['H2', 'cumple', 'Hecho y comunicado el 12/09'], ['H3', 'no_aplica', 'No es daño por agua'], ['H4', 'no_aplica', 'No es robo'], ['H5', 'cumple', 'Mampara de cristal, 320 € < 1.500 €, con foto'], ['H6', 'no_aplica', 'No aplica'], ['H7', 'no_aplica', 'Importe < 3.000 €'], ['H8', 'no_aplica', 'Vivienda habitada'], ['H9', 'cumple', '320 € < 10.000 €']],
    dec: 'DESPEJADO', motivo: 'Rotura accidental de mampara por 320 € con foto: despeje directo.', conf: 0.96, tok: [1340, 552, 158],
  },
  'MSG-B-09': {
    ramo: 'Salud', cr: ['Solicitud de analítica de control', 'Médico de cabecera del cuadro (Centro Médico Chamartín)', 'Póliza SA-223981'],
    d: { nombre_cliente: 'Sofía Martín Roca', numero_poliza: 'SA-223981', tipo_siniestro: 'Analítica de sangre y orina prescrita', fecha_hecho: null, importe_estimado_eur: null, lugar: 'Centro Médico Chamartín', terceros_implicados: false, lesionados: false, documentacion_mencionada: [], observaciones: 'Consulta si puede pedir cita directamente en el laboratorio.' },
    c: [['S1', 'cumple', 'Póliza SA-223981 identificada'], ['S2', 'cumple', 'Prueba básica sin carencia'], ['S3', 'cumple', 'Control rutinario'], ['S4', 'cumple', 'Analítica no requiere autorización'], ['S5', 'cumple', 'Prescripción de médico del cuadro'], ['S6', 'cumple', 'Analítica en cuadro médico'], ['S7', 'no_aplica', 'No hay reembolso'], ['S8', 'cumple', 'No aplica']],
    dec: 'DESPEJADO', motivo: 'Analítica de control prescrita por médico del cuadro: cita directa sin autorización.', conf: 0.94, tok: [1338, 540, 150],
  },
  'MSG-B-10': {
    ramo: 'Auto', cr: ['Accidente de circulación: salida de vía del BMW Serie 1 7788 KWS', 'Póliza AU-330912', 'El acompañante lesionado se menciona, pero el hecho causante es el accidente de tráfico: ramo principal Auto'],
    d: { nombre_cliente: 'Marcos Ruiz Alonso', numero_poliza: 'AU-330912', tipo_siniestro: 'Salida de vía con impacto contra quitamiedos', fecha_hecho: '2026-09-13', importe_estimado_eur: null, lugar: 'Carretera de Colmenar', terceros_implicados: false, lesionados: true, documentacion_mencionada: ['intervención policial con prueba de alcoholemia'], observaciones: 'El conductor reconoce haber tomado "un par de cervezas"; el acompañante fue trasladado en ambulancia; el vehículo no arranca.' },
    c: [['A1', 'cumple', 'Póliza AU-330912; sin mención de impago'], ['A2', 'cumple', 'Hecho de madrugada del 13/09, comunicado el mismo día'], ['A3', 'cumple', 'Conducía el tomador'], ['A4', 'incumple', '"Había tomado un par de cervezas" y la policía "me ha hecho la prueba": indicio de alcohol'], ['A5', 'incumple', 'Acompañante lesionado trasladado en ambulancia'], ['A6', 'no_aplica', 'Importe no indicado; "bastante mal, no arranca", posible siniestro total'], ['A7', 'no_aplica', 'No es supuesto de despeje directo'], ['A8', 'cumple', 'Relato coherente aunque incompleto']],
    dec: 'REVISION', motivo: 'Salida de vía con acompañante lesionado y reconocimiento de consumo de alcohol: daños corporales y posible exclusión; solicitar atestado y resultado de la alcoholemia.', conf: 0.95, tok: [1406, 660, 258],
  },
  'MSG-B-11': {
    ramo: 'Hogar', cr: ['Daño en instalación de la vivienda: placa de la caldera', 'Póliza HO-778345', 'Sobretensión por tormenta eléctrica'],
    d: { nombre_cliente: 'Adrián Moreno Lara', numero_poliza: 'HO-778345', tipo_siniestro: 'Daño eléctrico en caldera por sobretensión', fecha_hecho: '2026-09-09', importe_estimado_eur: 520, lugar: null, terceros_implicados: false, lesionados: false, documentacion_mencionada: ['informe del técnico oficial', 'presupuesto'], observaciones: 'Tormenta del 9 de septiembre.' },
    c: [['H1', 'cumple', 'Póliza HO-778345 identificada'], ['H2', 'cumple', 'Hecho el 09/09, comunicado el 10/09'], ['H3', 'no_aplica', 'No es daño por agua'], ['H4', 'no_aplica', 'No es robo'], ['H5', 'cumple', 'Daño eléctrico con informe técnico, 520 € < 1.500 €'], ['H6', 'cumple', 'Tormenta con fecha verificable; importe muy inferior a 10.000 €'], ['H7', 'no_aplica', 'Importe < 3.000 €'], ['H8', 'no_aplica', 'Vivienda habitada'], ['H9', 'cumple', '520 € < 10.000 €']],
    dec: 'DESPEJADO', motivo: 'Daño eléctrico en caldera por tormenta con informe técnico y 520 €: despeje directo.', conf: 0.95, tok: [1356, 570, 170],
  },
  'MSG-B-12': {
    ramo: 'Salud', cr: ['Prestación sanitaria: urgencias por corte', 'Hospital Ruber Juan Bravo "del cuadro"', 'Póliza SA-119920'],
    d: { nombre_cliente: 'Diego Herrera Solís', numero_poliza: 'SA-119920', tipo_siniestro: 'Urgencias por herida en la mano', fecha_hecho: '2026-09-14', importe_estimado_eur: null, lugar: 'Hospital Ruber Juan Bravo', terceros_implicados: false, lesionados: true, documentacion_mencionada: [], observaciones: 'Seis puntos de sutura.' },
    c: [['S1', 'cumple', 'Póliza SA-119920 identificada'], ['S2', 'cumple', 'Urgencia sin carencia'], ['S3', 'cumple', 'Lesión aguda'], ['S4', 'cumple', 'Urgencias no requieren autorización'], ['S5', 'cumple', 'Centro del cuadro'], ['S6', 'cumple', 'Urgencias en cuadro'], ['S7', 'no_aplica', 'No hay reembolso'], ['S8', 'cumple', 'Accidente doméstico']],
    dec: 'DESPEJADO', motivo: 'Urgencias por corte doméstico en hospital del cuadro: prestación directa.', conf: 0.95, tok: [1336, 538, 152],
  },
  'MSG-B-13': {
    ramo: 'Auto', cr: ['Daño en vehículo: Volkswagen Golf 4410 MBC', 'Póliza AU-104432', 'Alcance en semáforo con parte amistoso'],
    d: { nombre_cliente: 'Marta Vega Pons', numero_poliza: 'AU-104432', tipo_siniestro: 'Alcance trasero en semáforo', fecha_hecho: '2026-09-13', importe_estimado_eur: 2400, lugar: 'Paseo de la Castellana, Madrid', terceros_implicados: true, lesionados: false, documentacion_mencionada: ['parte amistoso', 'presupuesto de taller'], observaciones: 'El otro conductor reconoce la culpa; daños en portón, paragolpes y sensor.' },
    c: [['A1', 'cumple', 'Póliza AU-104432; sin mención de impago'], ['A2', 'cumple', 'Hecho y comunicado el 13/09'], ['A3', 'cumple', 'Conducía la tomadora'], ['A4', 'cumple', 'Sin indicios'], ['A5', 'cumple', 'Parte amistoso firmado; "Nadie herido"'], ['A6', 'cumple', '2.400 € < 6.000 €'], ['A7', 'cumple', 'Colisión simple con parte amistoso y presupuesto'], ['A8', 'cumple', 'Relato coherente con los daños traseros']],
    dec: 'DESPEJADO', motivo: 'Alcance con culpa reconocida por el tercero, parte amistoso y 2.400 €: despeje directo.', conf: 0.96, tok: [1374, 600, 190],
  },
  'MSG-B-14': {
    ramo: 'Hogar', cr: ['El bien dañado es el cristal de la puerta del garaje de la vivienda (chalet)', 'Póliza de hogar HO-450021', 'Se menciona el coche y la póliza AU-450021, pero "el coche no tiene nada": el ramo principal es Hogar'],
    d: { nombre_cliente: 'Javier Ortega Ríos', numero_poliza: 'HO-450021', tipo_siniestro: 'Rotura de cristal de la puerta del garaje', fecha_hecho: '2026-09-12', importe_estimado_eur: 450, lugar: 'Chalet en Boadilla', terceros_implicados: false, lesionados: false, documentacion_mencionada: ['presupuesto del cristalero'], observaciones: 'Rotura causada por el propio asegurado con el retrovisor de su coche; el vehículo no presenta daños.' },
    c: [['H1', 'cumple', 'Póliza HO-450021 identificada'], ['H2', 'cumple', 'Hecho y comunicado el 12/09'], ['H3', 'no_aplica', 'No es daño por agua'], ['H4', 'no_aplica', 'No es robo'], ['H5', 'cumple', 'Rotura de cristal de 450 € < 1.500 € con presupuesto'], ['H6', 'no_aplica', 'No aplica'], ['H7', 'no_aplica', 'Importe < 3.000 €'], ['H8', 'no_aplica', 'Vivienda habitada'], ['H9', 'cumple', '450 € < 10.000 €']],
    dec: 'DESPEJADO', motivo: 'Rotura de cristal en la vivienda (puerta del garaje) por 450 €; el vehículo no tiene daños: se tramita por Hogar como rotura de cristales.', conf: 0.86, tok: [1382, 618, 236],
  },
  'MSG-B-15': {
    ramo: 'Salud', cr: ['Prueba diagnóstica prescrita: ecografía ginecológica', 'Ginecóloga del cuadro (Clínica Nuestra Señora del Rosario)', 'Póliza SA-338812'],
    d: { nombre_cliente: 'Laura Gómez Sáenz', numero_poliza: 'SA-338812', tipo_siniestro: 'Ecografía ginecológica de control', fecha_hecho: null, importe_estimado_eur: null, lugar: 'Clínica Nuestra Señora del Rosario', terceros_implicados: false, lesionados: false, documentacion_mencionada: ['volante de prescripción'], observaciones: 'Pregunta si necesita autorización.' },
    c: [['S1', 'cumple', 'Póliza SA-338812 identificada'], ['S2', 'cumple', 'Prueba básica sin carencia'], ['S3', 'cumple', 'Control rutinario'], ['S4', 'cumple', 'Ecografía no requiere autorización previa'], ['S5', 'cumple', 'Prescripción de especialista del cuadro'], ['S6', 'cumple', 'Ecografía en cuadro médico'], ['S7', 'no_aplica', 'No hay reembolso'], ['S8', 'cumple', 'No aplica']],
    dec: 'DESPEJADO', motivo: 'Ecografía prescrita por ginecóloga del cuadro, con volante: no requiere autorización.', conf: 0.94, tok: [1344, 546, 156],
  },
  'MSG-B-16': {
    ramo: 'Auto', cr: ['Daño en vehículo: luna trasera del Dacia Sandero 2001 LFG', 'Póliza AU-612907', 'Intento de robo con denuncia'],
    d: { nombre_cliente: 'Raúl Pérez Iglesias', numero_poliza: 'AU-612907', tipo_siniestro: 'Rotura de luna trasera por intento de robo', fecha_hecho: '2026-09-14', importe_estimado_eur: 390, lugar: 'Vía pública', terceros_implicados: false, lesionados: false, documentacion_mencionada: ['denuncia', 'presupuesto del taller de lunas concertado'], observaciones: 'No sustrajeron nada.' },
    c: [['A1', 'cumple', 'Póliza AU-612907; sin mención de impago'], ['A2', 'cumple', 'Hecho esa noche, comunicado el 14/09'], ['A3', 'no_aplica', 'Vehículo estacionado'], ['A4', 'cumple', 'Sin indicios'], ['A5', 'cumple', 'Sin terceros identificables ni lesionados; denuncia presentada'], ['A6', 'cumple', '390 € < 6.000 €'], ['A7', 'cumple', 'Rotura de luna con denuncia y taller concertado'], ['A8', 'cumple', 'Relato coherente']],
    dec: 'DESPEJADO', motivo: 'Luna trasera rota en intento de robo, con denuncia y 390 € en taller concertado: despeje directo.', conf: 0.96, tok: [1352, 566, 168],
  },
  'MSG-B-17': {
    ramo: 'Hogar', cr: ['Daño en la vivienda: suelo laminado de cocina y pasillo', 'Póliza HO-213377', 'Fuga del desagüe de la lavadora'],
    d: { nombre_cliente: 'Beatriz Lozano Frías', numero_poliza: 'HO-213377', tipo_siniestro: 'Daños por agua por fuga de lavadora', fecha_hecho: '2026-09-12', importe_estimado_eur: 795, lugar: null, terceros_implicados: false, lesionados: false, documentacion_mencionada: ['factura del fontanero (95 €)', 'presupuesto de suelo (700 €)', 'fotos'], observaciones: 'Importe = 95 € reparación + 700 € suelo laminado.' },
    c: [['H1', 'cumple', 'Póliza HO-213377 identificada'], ['H2', 'cumple', 'Hecho el 12/09, comunicado el 13/09'], ['H3', 'cumple', 'Fuga súbita del desagüe durante un lavado, no filtración'], ['H4', 'no_aplica', 'No es robo'], ['H5', 'no_aplica', 'No es cristal ni eléctrico'], ['H6', 'no_aplica', 'No aplica'], ['H7', 'no_aplica', 'Importe < 3.000 €'], ['H8', 'no_aplica', 'Vivienda habitada'], ['H9', 'cumple', '795 € < 10.000 €']],
    dec: 'DESPEJADO', motivo: 'Daño por agua súbito por fuga de lavadora con facturas y fotos, 795 €: cumple las reglas de Hogar.', conf: 0.94, tok: [1368, 588, 184],
  },
  'MSG-B-18': {
    ramo: 'Salud', cr: ['Prestación sanitaria: fisioterapia prescrita', 'Traumatólogo del cuadro', 'Póliza SA-560034'],
    d: { nombre_cliente: 'Tomás Rubio Navas', numero_poliza: 'SA-560034', tipo_siniestro: 'Fisioterapia (10 sesiones) por esguince de tobillo', fecha_hecho: '2026-08-30', importe_estimado_eur: null, lugar: null, terceros_implicados: false, lesionados: true, documentacion_mencionada: ['prescripción del traumatólogo'], observaciones: 'Ya atendido en urgencias el 30/08; pregunta qué centro le corresponde.' },
    c: [['S1', 'cumple', 'Póliza SA-560034 identificada'], ['S2', 'cumple', 'Rehabilitación de lesión aguda sin carencia'], ['S3', 'cumple', 'Esguince reciente del 30/08'], ['S4', 'cumple', '10 sesiones: no supera el umbral que exige autorización'], ['S5', 'cumple', 'Prescripción de especialista del cuadro'], ['S6', 'cumple', 'Fisioterapia hasta 10 sesiones en cuadro'], ['S7', 'no_aplica', 'No hay reembolso'], ['S8', 'cumple', 'Lesión no laboral ni de tráfico']],
    dec: 'DESPEJADO', motivo: 'Diez sesiones de fisioterapia prescritas por traumatólogo del cuadro: dentro del límite sin autorización; asignar centro.', conf: 0.93, tok: [1362, 578, 180],
  },
  'MSG-B-19': {
    ramo: 'Auto', cr: ['Daño en vehículo: Ford Focus 6612 KGH', 'Póliza AU-887120 a todo riesgo', 'Rama caída durante la tormenta'],
    d: { nombre_cliente: 'Cristina Ibáñez Coll', numero_poliza: 'AU-887120', tipo_siniestro: 'Daños por caída de rama (fenómeno atmosférico)', fecha_hecho: '2026-09-09', importe_estimado_eur: 1900, lugar: 'Calle Serrano, Alcalá de Henares', terceros_implicados: false, lesionados: false, documentacion_mencionada: ['fotos con la rama sobre el coche', 'presupuesto del taller'], observaciones: 'Techo y parabrisas dañados; vehículo estacionado.' },
    c: [['A1', 'cumple', 'Póliza AU-887120; sin mención de impago'], ['A2', 'cumple', 'Hecho el 09/09, comunicado el 10/09'], ['A3', 'no_aplica', 'Vehículo estacionado'], ['A4', 'cumple', 'Sin indicios'], ['A5', 'cumple', 'Sin terceros ni lesionados'], ['A6', 'cumple', '1.900 € < 6.000 €'], ['A7', 'cumple', 'Fenómeno atmosférico con fotos y presupuesto en póliza a todo riesgo'], ['A8', 'cumple', 'Tormenta del 09/09 verificable']],
    dec: 'DESPEJADO', motivo: 'Daños por rama caída en tormenta, con fotos y 1.900 € en póliza a todo riesgo: despeje directo.', conf: 0.95, tok: [1364, 582, 178],
  },
  'MSG-B-20': {
    ramo: 'Hogar', cr: ['Daño en contenido de la vivienda: vitrocerámica', 'Póliza hogar HO-990017'],
    d: { nombre_cliente: 'Miguel Ángel Soto Vera', numero_poliza: 'HO-990017', tipo_siniestro: 'Rotura de cristal de vitrocerámica', fecha_hecho: '2026-09-14', importe_estimado_eur: 260, lugar: null, terceros_implicados: false, lesionados: false, documentacion_mencionada: ['foto', 'presupuesto del servicio técnico'], observaciones: null },
    c: [['H1', 'cumple', 'Póliza HO-990017 identificada'], ['H2', 'cumple', 'Hecho y comunicado el 14/09'], ['H3', 'no_aplica', 'No es daño por agua'], ['H4', 'no_aplica', 'No es robo'], ['H5', 'cumple', 'Vitrocerámica, 260 € < 1.500 €, con foto y presupuesto'], ['H6', 'no_aplica', 'No aplica'], ['H7', 'no_aplica', 'Importe < 3.000 €'], ['H8', 'no_aplica', 'Vivienda habitada'], ['H9', 'cumple', '260 € < 10.000 €']],
    dec: 'DESPEJADO', motivo: 'Rotura accidental de vitrocerámica por 260 € con foto y presupuesto: despeje directo.', conf: 0.96, tok: [1342, 550, 156],
  },

  // ───────────────────────── Paquete C ─────────────────────────
  'MSG-C-01': {
    ramo: 'Auto', cr: ['Daño en vehículo: Opel Corsa 1123 LHT', 'Póliza AU-233410', 'Colisión en parking con parte amistoso'],
    d: { nombre_cliente: 'Nuria Campos Vila', numero_poliza: 'AU-233410', tipo_siniestro: 'Colisión lateral en parking', fecha_hecho: '2026-09-13', importe_estimado_eur: 780, lugar: 'Parking del centro comercial Xanadú', terceros_implicados: true, lesionados: false, documentacion_mencionada: ['parte amistoso', 'presupuesto de taller'], observaciones: 'Culpa del tercero reconocida en el parte.' },
    c: [['A1', 'cumple', 'Póliza AU-233410; sin mención de impago'], ['A2', 'cumple', 'Hecho el 13/09, comunicado el 14/09'], ['A3', 'cumple', 'Conducía la tomadora'], ['A4', 'cumple', 'Sin indicios'], ['A5', 'cumple', 'Parte amistoso firmado; sin heridos'], ['A6', 'cumple', '780 € < 6.000 €'], ['A7', 'cumple', 'Colisión simple con parte amistoso'], ['A8', 'cumple', 'Relato coherente']],
    dec: 'DESPEJADO', motivo: 'Colisión leve en parking con parte amistoso y culpa del tercero, 780 €: despeje directo.', conf: 0.96, tok: [1358, 576, 176],
  },
  'MSG-C-02': {
    ramo: 'Hogar', cr: ['Sustracción de joyas en la vivienda', 'Póliza HO-771290', 'Denuncia presentada'],
    d: { nombre_cliente: 'Fernando Aguilar Mata', numero_poliza: 'HO-771290', tipo_siniestro: 'Sustracción de joyas en vivienda', fecha_hecho: '2026-09-12', importe_estimado_eur: 9000, lugar: null, terceros_implicados: false, lesionados: false, documentacion_mencionada: ['denuncia', 'algunas facturas de las joyas'], observaciones: '"La puerta estaba cerrada y sin marcas"; posible acceso por ventana del patio "entornada".' },
    c: [['H1', 'cumple', 'Póliza HO-771290; sin mención de impago'], ['H2', 'cumple', 'Descubierto el domingo 12/09, comunicado el 13/09'], ['H3', 'no_aplica', 'No es daño por agua'], ['H4', 'incumple', 'Sin signos de fuerza ("sin marcas", ventana "entornada") y joyas por 9.000 € > límite de 3.000 €; hay denuncia'], ['H5', 'no_aplica', 'No es cristal ni eléctrico'], ['H6', 'no_aplica', 'No es vandalismo'], ['H7', 'no_aplica', 'No consta antigüedad de la póliza'], ['H8', 'no_aplica', 'Ausencia de fin de semana'], ['H9', 'cumple', '9.000 € < 10.000 €, aunque muy cerca del umbral']],
    dec: 'REVISION', motivo: 'Sustracción de joyas por 9.000 € sin signos de fuerza y posible ventana entornada: no cumple el requisito de robo con fuerza y excede el límite de joyas; peritación y verificación de facturas.', conf: 0.93, tok: [1396, 646, 250],
  },
  'MSG-C-03': {
    ramo: 'Salud', cr: ['Prestación sanitaria: urgencias por reacción alérgica', 'Hospital HM Montepríncipe "del cuadro"', 'Póliza SA-664120'],
    d: { nombre_cliente: 'Andrea Molina Paz', numero_poliza: 'SA-664120', tipo_siniestro: 'Urgencias por reacción alérgica', fecha_hecho: '2026-09-14', importe_estimado_eur: null, lugar: 'Hospital HM Montepríncipe', terceros_implicados: false, lesionados: false, documentacion_mencionada: [], observaciones: 'Hinchazón facial tras ingerir marisco; medicación en urgencias.' },
    c: [['S1', 'cumple', 'Póliza SA-664120 identificada'], ['S2', 'cumple', 'Urgencia vital sin carencia'], ['S3', 'cumple', 'Episodio agudo'], ['S4', 'cumple', 'Urgencias no requieren autorización'], ['S5', 'cumple', 'Centro del cuadro'], ['S6', 'cumple', 'Urgencias en cuadro'], ['S7', 'no_aplica', 'No hay reembolso'], ['S8', 'cumple', 'No aplica']],
    dec: 'DESPEJADO', motivo: 'Urgencias por reacción alérgica en hospital del cuadro: prestación directa sin carencia.', conf: 0.95, tok: [1340, 542, 154],
  },
  'MSG-C-04': {
    ramo: 'Auto', cr: ['Daño en vehículo: parabrisas del Mazda 3 5590 MCD', 'Póliza AU-145522', 'Taller de lunas concertado'],
    d: { nombre_cliente: 'Óscar Delgado Ruiz', numero_poliza: 'AU-145522', tipo_siniestro: 'Impacto en parabrisas', fecha_hecho: '2026-09-11', importe_estimado_eur: 310, lugar: 'Autovía A-6', terceros_implicados: false, lesionados: false, documentacion_mencionada: ['propuesta del taller de lunas concertado'], observaciones: 'Estrella de 3 cm en zona del conductor; se propone sustitución.' },
    c: [['A1', 'cumple', 'Póliza AU-145522; sin mención de impago'], ['A2', 'cumple', 'Hecho el 11/09, comunicado el 12/09'], ['A3', 'cumple', 'Conducía el tomador'], ['A4', 'cumple', 'Sin indicios'], ['A5', 'cumple', 'Sin terceros ni lesionados'], ['A6', 'cumple', '310 € < 6.000 €'], ['A7', 'cumple', 'Rotura de luna en taller concertado'], ['A8', 'cumple', 'Relato coherente']],
    dec: 'DESPEJADO', motivo: 'Impacto en parabrisas con sustitución por 310 € en taller concertado: despeje directo.', conf: 0.97, tok: [1346, 552, 158],
  },
  'MSG-C-05': {
    ramo: 'Hogar', cr: ['Daño en la vivienda: techo del baño', 'Póliza HO-345610', 'Fuga procedente del vecino de arriba'],
    d: { nombre_cliente: 'Patricia Ferrer Oliva', numero_poliza: 'HO-345610', tipo_siniestro: 'Daños por agua procedentes del vecino superior', fecha_hecho: '2026-09-11', importe_estimado_eur: 850, lugar: null, terceros_implicados: true, lesionados: false, documentacion_mencionada: ['fotos', 'presupuesto', 'contacto del vecino'], observaciones: 'El vecino confirma rotura de tubería y ha avisado a su seguro: posible recobro.' },
    c: [['H1', 'cumple', 'Póliza HO-345610 identificada'], ['H2', 'cumple', 'Daño desde el jueves 11/09, comunicado el 13/09'], ['H3', 'cumple', 'Rotura de tubería en la vivienda superior: daño súbito, no filtración por mantenimiento'], ['H4', 'no_aplica', 'No es robo'], ['H5', 'no_aplica', 'No es cristal ni eléctrico'], ['H6', 'no_aplica', 'No aplica'], ['H7', 'no_aplica', 'Importe < 3.000 €'], ['H8', 'no_aplica', 'Vivienda habitada'], ['H9', 'cumple', '850 € < 10.000 €']],
    dec: 'DESPEJADO', motivo: 'Daño por agua súbito procedente del vecino, con fotos y presupuesto de 850 €: tramitar y abrir recobro contra el seguro del vecino.', conf: 0.93, tok: [1374, 606, 200],
  },
  'MSG-C-06': {
    ramo: 'Salud', cr: ['Solicitud de prestación sanitaria: rehabilitación', 'Seguro de salud SA-772034', 'Origen laboral de la lesión (almacén de la empresa, baja, mutua): posible competencia de la mutua'],
    d: { nombre_cliente: 'Rubén Sanz Alcaide', numero_poliza: 'SA-772034', tipo_siniestro: 'Rehabilitación por lumbalgia con ciática', fecha_hecho: '2026-09-02', importe_estimado_eur: null, lugar: 'Almacén de la empresa del asegurado', terceros_implicados: false, lesionados: true, documentacion_mencionada: [], observaciones: 'Solicita autorización de 15 sesiones de fisioterapia; está de baja laboral.' },
    c: [['S1', 'cumple', 'Póliza SA-772034 identificada'], ['S2', 'cumple', 'Rehabilitación de lesión aguda sin carencia'], ['S3', 'cumple', 'Lesión reciente del 02/09'], ['S4', 'cumple', '15 sesiones > 10: se solicita autorización previa antes de iniciar'], ['S5', 'no_aplica', 'Centro no indicado todavía'], ['S6', 'no_aplica', 'Supera las 10 sesiones del despeje directo'], ['S7', 'no_aplica', 'No hay reembolso'], ['S8', 'incumple', 'Lesión "moviendo palés en el almacén de mi empresa" con baja: accidente laboral, corresponde a la mutua']],
    dec: 'REVISION', motivo: 'Lesión en accidente laboral con baja: la rehabilitación corresponde en primer lugar a la mutua; revisar antes de autorizar 15 sesiones de fisioterapia.', conf: 0.92, tok: [1380, 630, 244],
  },
  'MSG-C-07': {
    ramo: 'Auto', cr: ['Daño en vehículo: Citroën C4 3345 LDS', 'Póliza AU-556780 a todo riesgo', 'Granizo del 10/09 en Lleida'],
    d: { nombre_cliente: 'Silvia Marín Costa', numero_poliza: 'AU-556780', tipo_siniestro: 'Daños por granizo', fecha_hecho: '2026-09-10', importe_estimado_eur: 2600, lugar: 'Lleida', terceros_implicados: false, lesionados: false, documentacion_mencionada: ['fotos', 'presupuesto de chapa'], observaciones: 'Abolladuras en capó, techo y maletero; vehículo estacionado.' },
    c: [['A1', 'cumple', 'Póliza AU-556780; sin mención de impago'], ['A2', 'cumple', 'Hecho el 10/09, comunicado el 11/09'], ['A3', 'no_aplica', 'Vehículo estacionado'], ['A4', 'cumple', 'Sin indicios'], ['A5', 'cumple', 'Sin terceros ni lesionados'], ['A6', 'cumple', '2.600 € < 6.000 €'], ['A7', 'cumple', 'Granizo con fotos y presupuesto en póliza a todo riesgo'], ['A8', 'cumple', 'Tormenta del 10/09 verificable']],
    dec: 'DESPEJADO', motivo: 'Daños por granizo con fotos y presupuesto de 2.600 € en póliza a todo riesgo: despeje directo.', conf: 0.95, tok: [1354, 572, 172],
  },
  'MSG-C-08': {
    ramo: 'Hogar', cr: ['Daño en la vivienda: cristal de la ventana de la cocina', 'Póliza HO-128870'],
    d: { nombre_cliente: 'Gonzalo Prieto Lima', numero_poliza: 'HO-128870', tipo_siniestro: 'Rotura de cristal por golpe de viento', fecha_hecho: '2026-09-14', importe_estimado_eur: 300, lugar: null, terceros_implicados: false, lesionados: false, documentacion_mencionada: ['foto', 'presupuesto del cristalero'], observaciones: null },
    c: [['H1', 'cumple', 'Póliza HO-128870 identificada'], ['H2', 'cumple', 'Hecho y comunicado el 14/09'], ['H3', 'no_aplica', 'No es daño por agua'], ['H4', 'no_aplica', 'No es robo'], ['H5', 'cumple', 'Rotura de cristal de 300 € < 1.500 € con foto'], ['H6', 'no_aplica', 'Fenómeno leve; tratado como rotura de cristales'], ['H7', 'no_aplica', 'Importe < 3.000 €'], ['H8', 'no_aplica', 'Vivienda habitada'], ['H9', 'cumple', '300 € < 10.000 €']],
    dec: 'DESPEJADO', motivo: 'Rotura de cristal por golpe de viento, 300 € con foto: despeje directo.', conf: 0.96, tok: [1338, 548, 156],
  },
  'MSG-C-09': {
    ramo: 'Salud', cr: ['Prueba diagnóstica prescrita: radiografía de muñeca', 'Médico del cuadro', 'Póliza SA-905567'],
    d: { nombre_cliente: 'Inés Caballero Ros', numero_poliza: 'SA-905567', tipo_siniestro: 'Radiografía de muñeca tras caída', fecha_hecho: '2026-09-11', importe_estimado_eur: null, lugar: 'Centro de diagnóstico de la calle Orense', terceros_implicados: false, lesionados: true, documentacion_mencionada: ['volante'], observaciones: 'Caída en la vía pública.' },
    c: [['S1', 'cumple', 'Póliza SA-905567 identificada'], ['S2', 'cumple', 'Prueba básica sin carencia'], ['S3', 'cumple', 'Lesión aguda por caída'], ['S4', 'cumple', 'Radiografía no requiere autorización'], ['S5', 'cumple', 'Prescripción de médico del cuadro'], ['S6', 'cumple', 'Radiografía en cuadro'], ['S7', 'no_aplica', 'No hay reembolso'], ['S8', 'cumple', 'Caída en la calle, no laboral ni de tráfico']],
    dec: 'DESPEJADO', motivo: 'Radiografía prescrita por médico del cuadro con volante: cita directa sin autorización.', conf: 0.94, tok: [1346, 556, 164],
  },
  'MSG-C-10': {
    ramo: 'Auto', cr: ['Daño en vehículo: Skoda Octavia 7723 KZP', 'Póliza AU-398120', 'Alcance en la M-40 con parte amistoso'],
    d: { nombre_cliente: 'Víctor Lara Benítez', numero_poliza: 'AU-398120', tipo_siniestro: 'Alcance trasero en retención', fecha_hecho: '2026-09-13', importe_estimado_eur: 1500, lugar: 'M-40, Madrid', terceros_implicados: true, lesionados: false, documentacion_mencionada: ['parte amistoso', 'presupuesto de taller'], observaciones: 'El otro conductor asume la culpa.' },
    c: [['A1', 'cumple', 'Póliza AU-398120; sin mención de impago'], ['A2', 'cumple', 'Hecho y comunicado el 13/09'], ['A3', 'cumple', 'Conducía el tomador'], ['A4', 'cumple', 'Sin indicios'], ['A5', 'cumple', 'Parte amistoso firmado; "Sin heridos"'], ['A6', 'cumple', '1.500 € < 6.000 €'], ['A7', 'cumple', 'Colisión simple con parte amistoso'], ['A8', 'cumple', 'Relato coherente']],
    dec: 'DESPEJADO', motivo: 'Alcance con culpa asumida por el tercero, parte amistoso y 1.500 €: despeje directo.', conf: 0.96, tok: [1356, 574, 174],
  },
  'MSG-C-11': {
    ramo: 'Hogar', cr: ['Daño en contenido de la vivienda: frigorífico', 'Póliza HO-604419', 'Sobretensión tras corte de luz'],
    d: { nombre_cliente: 'Alicia Núñez Prado', numero_poliza: 'HO-604419', tipo_siniestro: 'Daño eléctrico en frigorífico por sobretensión', fecha_hecho: '2026-09-09', importe_estimado_eur: 480, lugar: null, terceros_implicados: false, lesionados: false, documentacion_mencionada: ['informe del técnico'], observaciones: 'La compañía eléctrica reconoce la incidencia en el barrio.' },
    c: [['H1', 'cumple', 'Póliza HO-604419 identificada'], ['H2', 'cumple', 'Hecho el 09/09, comunicado el 10/09'], ['H3', 'no_aplica', 'No es daño por agua'], ['H4', 'no_aplica', 'No es robo'], ['H5', 'cumple', 'Daño eléctrico con informe técnico, 480 € < 1.500 €'], ['H6', 'no_aplica', 'No aplica'], ['H7', 'no_aplica', 'Importe < 3.000 €'], ['H8', 'no_aplica', 'Vivienda habitada'], ['H9', 'cumple', '480 € < 10.000 €']],
    dec: 'DESPEJADO', motivo: 'Daño eléctrico por sobretensión reconocida, con informe técnico y 480 €: despeje directo.', conf: 0.95, tok: [1350, 566, 168],
  },
  'MSG-C-12': {
    ramo: 'Salud', cr: ['Prestación sanitaria: urgencias pediátricas', 'Hospital Sanitas La Moraleja', 'Póliza familiar SA-230981 con el hijo incluido'],
    d: { nombre_cliente: 'Julia Ortiz Reina (por su hijo Leo, 5 años)', numero_poliza: 'SA-230981', tipo_siniestro: 'Urgencias pediátricas por otitis', fecha_hecho: '2026-09-14', importe_estimado_eur: null, lugar: 'Hospital Sanitas La Moraleja', terceros_implicados: false, lesionados: false, documentacion_mencionada: [], observaciones: 'Antibiótico prescrito.' },
    c: [['S1', 'cumple', 'El hijo está "en la póliza familiar SA-230981"'], ['S2', 'cumple', 'Urgencia sin carencia'], ['S3', 'cumple', 'Proceso agudo'], ['S4', 'cumple', 'Urgencias no requieren autorización'], ['S5', 'cumple', 'Centro habitual del cuadro'], ['S6', 'cumple', 'Urgencias pediátricas en cuadro'], ['S7', 'no_aplica', 'No hay reembolso'], ['S8', 'cumple', 'No aplica']],
    dec: 'DESPEJADO', motivo: 'Urgencias pediátricas por otitis de beneficiario en póliza familiar: prestación directa.', conf: 0.95, tok: [1342, 546, 158],
  },
};

// Expande el formato compacto al esquema completo que devuelve el modelo
function expandirResultadoGuardado(r) {
  return {
    ramo: r.ramo,
    criterios_ramo: r.cr,
    datos_extraidos: r.d,
    criterios: r.c.map(([regla, resultado, evidencia]) => ({ regla, descripcion: REGLA_DESC[regla] || '', resultado, evidencia })),
    decision: r.dec,
    motivo: r.motivo,
    confianza: r.conf,
    usage: { input: r.tok[0], output: r.tok[1], reasoning: r.tok[2] },
  };
}
