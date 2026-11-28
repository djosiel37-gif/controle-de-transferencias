// Lista de bens das fazendas Lindos Campos e Bom Jesus (Relatório de Bens, 28/11/2026, 46 bens).
// Usada pela tela "Importar lista de bens" (Mais → Cópia e importação). Só o administrador importa.
// Campos: codigo (Cód. Ref.), patrimonio (Código do sistema de bens), nome, tipo, marca, serie,
// fazenda (LC = Lindos Campos, BJ = Bom Jesus), proprietario, compra (data de compra).
export const FAZENDAS_BENS = {
  LC: 'Fazenda Lindos Campos',
  BJ: 'Fazenda Bom Jesus'
};

const MA = 'MARCO AURELIO PARZIANELLO II', GI = 'GIOVANNI PARZIANELLO', ED = 'EDUARDO PARZIANELLO';

// [codigo, patrimonio, nome, tipo, marca, chassi/série, fazenda, proprietário, data de compra]
const L = [
  ['CL-05', '000005', 'Colheitadeira de grãos Axial Flow 8230', 'Colheitadeira', 'Case IH', 'JHFY8230LFB05785', 'LC', MA, '2016-08-31'],
  ['PG-05', '000051', 'Plataforma de corte 3162 40 pés', 'Plataforma de corte', 'Case IH', 'HCCBDF40HGCC00427', 'LC', MA, '2016-09-29'],
  ['PG-02', '000082', 'Plataforma de corte 3162 40 pés', 'Plataforma de corte', 'Case IH', 'YEH040126', 'LC', MA, '2016-03-22'],
  ['IM-47', '000296', 'Pulverizador agrícola atomizador', 'Implemento', '', '', 'LC', MA, '2020-04-16'],
  ['PG-16', '000327', 'Plataforma de corte 45 pés', 'Plataforma de corte', '', 'HCCB45FCCLCK19291', 'LC', MA, '2020-11-30'],
  ['CL-15', '000329', 'Colheitadeira de grãos Axial Flow 8250', 'Colheitadeira', 'Case IH', 'JHFY8250ELJB15379', 'LC', MA, '2020-11-30'],
  ['PG-18', '000345', 'Plataforma de corte 45 pés', 'Plataforma de corte', '', 'HCCV45FCAMCK19478', 'LC', MA, '2021-02-19'],
  ['CL-17', '000363', 'Colheitadeira de grãos Axial Flow 8250', 'Colheitadeira', 'Case IH', 'JHFY8250CMJB16736', 'LC', MA, '2021-02-19'],
  ['AP-03', '000375', 'Distribuidor Hercules 6.0', 'Distribuidor', '', '', 'LC', GI, '2021-09-13'],
  ['EL-47', '00635', 'Freezer horizontal Electrolux H440', 'Eletrodoméstico', 'Electrolux', '', 'BJ', MA, '2024-06-01'],
  ['EL-52', '00641', 'Geladeira Electrolux 474 L', 'Eletrodoméstico', 'Electrolux', '', 'BJ', MA, '2024-06-29'],
  ['EQ-189', '00642', 'Chave de impacto 3/4 pneumática', 'Ferramenta', '', '', 'BJ', MA, '2024-07-02'],
  ['EQ-190', '00643', 'Chave de impacto 1/2 pneumática', 'Ferramenta', '', '', 'BJ', MA, '2024-07-02'],
  ['EQ-191', '00644', 'Esmerilhadeira / lixadeira DGA504Z', 'Ferramenta', '', '', 'BJ', MA, '2024-07-02'],
  ['EQ-192', '00645', 'Motobomba centrífuga 3 CV Schneider', 'Motobomba', 'Schneider', '', 'BJ', MA, '2024-07-02'],
  ['IM-68', '00681', 'Rolo faca Katrina F5/9 barra de tração', 'Implemento', 'Katrina', '', 'BJ', GI, '2024-07-26'],
  ['EL-65', '00686', 'Bebedouro Acqua Gelata PRE-50 inox 2 torneiras', 'Eletrodoméstico', 'Acqua Gelata', '', 'BJ', MA, '2024-06-03'],
  ['CL-18', 'CL-18', 'Colheitadeira de grãos Axial Flow 8250', 'Colheitadeira', 'Case IH', 'JHFY8250HRJB27062', 'LC', MA, '2024-09-25'],
  ['CL-21', 'CL-21', 'Colheitadeira de grãos Axial Flow 8250', 'Colheitadeira', 'Case IH', 'JHFY8250PRJB27200', 'LC', MA, '2024-10-28'],
  ['EQ-253', 'EQ-253', 'Motobomba diesel 4x4 TDWP100SEXP partida', 'Motobomba', '', '', 'LC', ED, '2025-04-22'],
  ['EQ-258', 'EQ-258', 'Bebedouro industrial 50 L/h aço inox Frisbel', 'Eletrodoméstico', 'Frisbel', '', 'LC', MA, '2025-10-09'],
  ['EQ-259', 'EQ-259', 'Carregador de bateria F100-12/24 RNEW', 'Equipamento', '', '', 'LC', MA, '2025-11-06'],
  ['EQ-263', 'EQ-263', 'Termonebulizador K-02 partida elétrica', 'Equipamento', '', '', 'LC', ED, '2026-01-29'],
  ['EQ-265', 'EQ-265', 'Soprador costal motor 4-MIX 4283-200-0000 BR 800', 'Equipamento', 'Stihl', '', 'LC', MA, '2026-03-16'],
  ['EQ-266', 'EQ-266', 'Soprador BG 86 Stihl', 'Equipamento', 'Stihl', '', 'LC', MA, '2026-03-23'],
  ['EQ-267', 'EQ-267', 'Soprador BG 86 Stihl', 'Equipamento', 'Stihl', '', 'LC', MA, '2026-03-23'],
  ['EQ-268', 'EQ-268', 'Motobomba diesel 4x4 auto escorvante TDWP100SEXP', 'Motobomba', '', '', 'LC', ED, '2026-04-01'],
  ['EQ-269', 'EQ-269', 'Motosserra Stihl MS 172 gasolina 35R', 'Equipamento', 'Stihl', '', 'LC', MA, '2026-04-08'],
  ['EQ-272', 'EQ-272', 'Motosserra MS 462 63 cm 25,36RS', 'Equipamento', 'Stihl', '', 'LC', MA, '2026-06-25'],
  ['EQ-275', 'EQ-275', 'Detector de 4 gases', 'Equipamento', '', '', 'LC', GI, '2026-07-16'],
  ['EQ-277', 'EQ-277', 'Compressor 30/250 L 220/380 V trifásico Chiaperini', 'Compressor', 'Chiaperini', '', 'LC', GI, '2026-08-11'],
  ['EQ-278', 'EQ-278', 'Compressor 30/250 L 220/380 V trifásico Chiaperini', 'Compressor', 'Chiaperini', '', 'LC', MA, '2026-08-21'],
  ['EQ-279', 'EQ-279', 'Bebedouro industrial 50 L LIC050 inox', 'Eletrodoméstico', '', '', 'LC', ED, '2026-08-28'],
  ['EQ-281', 'EQ-281', 'Transformador monofásico 10 kVA 34,5 kV 230/115 V', 'Equipamento', '', '', 'LC', ED, '2026-11-18'],
  ['EQ-53', 'EQ-53', 'Compressor 140 lbs 2 HP 10/175 L monofásico', 'Compressor', '', '', 'LC', MA, '2018-07-21'],
  ['FR-15', 'FR-15', 'Chave de impacto 3/4 TW001GD201', 'Ferramenta', '', '', 'LC', ED, '2026-09-29'],
  ['PG-20', 'PG-20', 'Plataforma de corte 45 pés', 'Plataforma de corte', '', 'HCCB45FCVRCK24002', 'LC', MA, '2024-09-25'],
  ['PL-17', 'PL-17', 'Plantadeira Case Fast Rise 38 linhas', 'Plantadeira', 'Case IH', 'PRCY6138ARPD05472', 'LC', ED, '2024-10-24'],
  ['PL-18', 'PL-18', 'Plantadeira Case 40 linhas', 'Plantadeira', 'Case IH', 'PRCY6140CRPD05504', 'LC', ED, '2024-10-24'],
  ['PU-09', 'PU-09', 'Pulverizador Patriot 350', 'Pulverizador', 'Case IH', 'PRCYP350JRPC07411', 'LC', ED, '2024-10-24'],
  ['TR-31', 'TR-31', 'Trator Case Magnum 380', 'Trator', 'Case IH', 'HCCZM380KPCM64361', 'LC', ED, '2024-10-24'],
  ['TR-32', 'TR-32', 'Trator Case Magnum 380', 'Trator', 'Case IH', 'HCCZM380HRCM67949', 'LC', ED, '2024-10-24'],
  ['TR-33', 'TR-33', 'Trator Case Magnum 380', 'Trator', 'Case IH', 'HCCZM380ARCM76552', 'LC', ED, '2024-10-24'],
  ['VL-20', 'VL-20', 'Motocicleta Honda Pop 110 preta', 'Veículo leve', 'Honda', '', 'LC', MA, '2020-01-01'],
  ['VL-70', 'VL-70', 'Ônibus M.Benz / Busscar Urb Plus U', 'Veículo', 'Mercedes-Benz / Busscar', 'Placa ARA3C18 (antiga ARA3218) · Chassi 9BM3840789B627301 · Renavam 00128464526', 'LC', '', '2025-11-01'],
  ['VL-77', 'VL-77', 'Motocicleta Honda Pop 100 branca', 'Veículo leve', 'Honda', '', 'LC', MA, '2020-01-01']
];

export const BENS = L.map(([codigo, patrimonio, nome, tipo, marca, serie, fazenda, proprietario, compra]) =>
  ({ codigo, patrimonio, nome, tipo, marca, serie, fazenda, proprietario, compra }));
