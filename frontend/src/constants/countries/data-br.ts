// =============================================================================
// Brasil - 26 Estados + Distrito Federal + Ciudades principales COMPLETO
// =============================================================================
import type { Subdivision, City } from './index';

export const BR_SUBDIVISIONS: readonly Subdivision[] = [
  { code: 'BR-AC', name: 'Acre', capital: 'Rio Branco', country: 'BR' },
  { code: 'BR-AL', name: 'Alagoas', capital: 'Maceió', country: 'BR' },
  { code: 'BR-AP', name: 'Amapá', capital: 'Macapá', country: 'BR' },
  { code: 'BR-AM', name: 'Amazonas', capital: 'Manaus', country: 'BR' },
  { code: 'BR-BA', name: 'Bahia', capital: 'Salvador', country: 'BR' },
  { code: 'BR-CE', name: 'Ceará', capital: 'Fortaleza', country: 'BR' },
  { code: 'BR-DF', name: 'Distrito Federal', capital: 'Brasília', country: 'BR' },
  { code: 'BR-ES', name: 'Espírito Santo', capital: 'Vitória', country: 'BR' },
  { code: 'BR-GO', name: 'Goiás', capital: 'Goiânia', country: 'BR' },
  { code: 'BR-MA', name: 'Maranhão', capital: 'São Luís', country: 'BR' },
  { code: 'BR-MT', name: 'Mato Grosso', capital: 'Cuiabá', country: 'BR' },
  { code: 'BR-MS', name: 'Mato Grosso do Sul', capital: 'Campo Grande', country: 'BR' },
  { code: 'BR-MG', name: 'Minas Gerais', capital: 'Belo Horizonte', country: 'BR' },
  { code: 'BR-PA', name: 'Pará', capital: 'Belém', country: 'BR' },
  { code: 'BR-PB', name: 'Paraíba', capital: 'João Pessoa', country: 'BR' },
  { code: 'BR-PR', name: 'Paraná', capital: 'Curitiba', country: 'BR' },
  { code: 'BR-PE', name: 'Pernambuco', capital: 'Recife', country: 'BR' },
  { code: 'BR-PI', name: 'Piauí', capital: 'Teresina', country: 'BR' },
  { code: 'BR-RJ', name: 'Rio de Janeiro', capital: 'Rio de Janeiro', country: 'BR' },
  { code: 'BR-RN', name: 'Rio Grande do Norte', capital: 'Natal', country: 'BR' },
  { code: 'BR-RS', name: 'Rio Grande do Sul', capital: 'Porto Alegre', country: 'BR' },
  { code: 'BR-RO', name: 'Rondônia', capital: 'Porto Velho', country: 'BR' },
  { code: 'BR-RR', name: 'Roraima', capital: 'Boa Vista', country: 'BR' },
  { code: 'BR-SC', name: 'Santa Catarina', capital: 'Florianópolis', country: 'BR' },
  { code: 'BR-SP', name: 'São Paulo', capital: 'São Paulo', country: 'BR' },
  { code: 'BR-SE', name: 'Sergipe', capital: 'Aracaju', country: 'BR' },
  { code: 'BR-TO', name: 'Tocantins', capital: 'Palmas', country: 'BR' },
];

export const BR_CITIES: readonly City[] = [
  // Acre
  { code: 'BR-RBR', name: 'Rio Branco', subdivisionCode: 'BR-AC', country: 'BR', isCapital: true },
  { code: 'BR-CZS', name: 'Cruzeiro do Sul', subdivisionCode: 'BR-AC', country: 'BR' },
  // Alagoas
  { code: 'BR-MCZ', name: 'Maceió', subdivisionCode: 'BR-AL', country: 'BR', isCapital: true },
  { code: 'BR-ARP', name: 'Arapiraca', subdivisionCode: 'BR-AL', country: 'BR' },
  // Amapá
  { code: 'BR-MCP', name: 'Macapá', subdivisionCode: 'BR-AP', country: 'BR', isCapital: true },
  { code: 'BR-STN', name: 'Santana', subdivisionCode: 'BR-AP', country: 'BR' },
  // Amazonas
  { code: 'BR-MAO', name: 'Manaus', subdivisionCode: 'BR-AM', country: 'BR', isCapital: true },
  { code: 'BR-PAR', name: 'Parintins', subdivisionCode: 'BR-AM', country: 'BR' },
  { code: 'BR-ITB', name: 'Itacoatiara', subdivisionCode: 'BR-AM', country: 'BR' },
  { code: 'BR-MZS', name: 'Manacapuru', subdivisionCode: 'BR-AM', country: 'BR' },
  // Bahia
  { code: 'BR-SSA', name: 'Salvador', subdivisionCode: 'BR-BA', country: 'BR', isCapital: true },
  { code: 'BR-FDS', name: 'Feira de Santana', subdivisionCode: 'BR-BA', country: 'BR' },
  { code: 'BR-VDC', name: 'Vitória da Conquista', subdivisionCode: 'BR-BA', country: 'BR' },
  { code: 'BR-CAM', name: 'Camaçari', subdivisionCode: 'BR-BA', country: 'BR' },
  { code: 'BR-ITA', name: 'Itabuna', subdivisionCode: 'BR-BA', country: 'BR' },
  { code: 'BR-ILH', name: 'Ilhéus', subdivisionCode: 'BR-BA', country: 'BR' },
  // Ceará
  { code: 'BR-FOR', name: 'Fortaleza', subdivisionCode: 'BR-CE', country: 'BR', isCapital: true },
  { code: 'BR-JNR', name: 'Juazeiro do Norte', subdivisionCode: 'BR-CE', country: 'BR' },
  { code: 'BR-SOB', name: 'Sobral', subdivisionCode: 'BR-CE', country: 'BR' },
  { code: 'BR-CAU', name: 'Caucaia', subdivisionCode: 'BR-CE', country: 'BR' },
  { code: 'BR-MRC', name: 'Maracanaú', subdivisionCode: 'BR-CE', country: 'BR' },
  // Distrito Federal
  { code: 'BR-BSB', name: 'Brasília', subdivisionCode: 'BR-DF', country: 'BR', isCapital: true },
  { code: 'BR-TAG', name: 'Taguatinga', subdivisionCode: 'BR-DF', country: 'BR' },
  { code: 'BR-CEI', name: 'Ceilândia', subdivisionCode: 'BR-DF', country: 'BR' },
  // Espírito Santo
  { code: 'BR-VIX', name: 'Vitória', subdivisionCode: 'BR-ES', country: 'BR', isCapital: true },
  { code: 'BR-VVL', name: 'Vila Velha', subdivisionCode: 'BR-ES', country: 'BR' },
  { code: 'BR-SRR', name: 'Serra', subdivisionCode: 'BR-ES', country: 'BR' },
  { code: 'BR-CRI', name: 'Cariacica', subdivisionCode: 'BR-ES', country: 'BR' },
  // Goiás
  { code: 'BR-GYN', name: 'Goiânia', subdivisionCode: 'BR-GO', country: 'BR', isCapital: true },
  { code: 'BR-APN', name: 'Aparecida de Goiânia', subdivisionCode: 'BR-GO', country: 'BR' },
  { code: 'BR-ANG', name: 'Anápolis', subdivisionCode: 'BR-GO', country: 'BR' },
  // Maranhão
  { code: 'BR-SLZ', name: 'São Luís', subdivisionCode: 'BR-MA', country: 'BR', isCapital: true },
  { code: 'BR-IMP', name: 'Imperatriz', subdivisionCode: 'BR-MA', country: 'BR' },
  { code: 'BR-TIR', name: 'Timon', subdivisionCode: 'BR-MA', country: 'BR' },
  // Mato Grosso
  { code: 'BR-CGB', name: 'Cuiabá', subdivisionCode: 'BR-MT', country: 'BR', isCapital: true },
  { code: 'BR-VGD', name: 'Várzea Grande', subdivisionCode: 'BR-MT', country: 'BR' },
  { code: 'BR-RDN', name: 'Rondonópolis', subdivisionCode: 'BR-MT', country: 'BR' },
  { code: 'BR-SNP', name: 'Sinop', subdivisionCode: 'BR-MT', country: 'BR' },
  // Mato Grosso do Sul
  { code: 'BR-CGR', name: 'Campo Grande', subdivisionCode: 'BR-MS', country: 'BR', isCapital: true },
  { code: 'BR-DOU', name: 'Dourados', subdivisionCode: 'BR-MS', country: 'BR' },
  { code: 'BR-TLG', name: 'Três Lagoas', subdivisionCode: 'BR-MS', country: 'BR' },
  { code: 'BR-CMB', name: 'Corumbá', subdivisionCode: 'BR-MS', country: 'BR' },
  // Minas Gerais
  { code: 'BR-BHZ', name: 'Belo Horizonte', subdivisionCode: 'BR-MG', country: 'BR', isCapital: true },
  { code: 'BR-UBL', name: 'Uberlândia', subdivisionCode: 'BR-MG', country: 'BR' },
  { code: 'BR-CNT', name: 'Contagem', subdivisionCode: 'BR-MG', country: 'BR' },
  { code: 'BR-JDF', name: 'Juiz de Fora', subdivisionCode: 'BR-MG', country: 'BR' },
  { code: 'BR-BET', name: 'Betim', subdivisionCode: 'BR-MG', country: 'BR' },
  { code: 'BR-MOC', name: 'Montes Claros', subdivisionCode: 'BR-MG', country: 'BR' },
  { code: 'BR-UBA', name: 'Uberaba', subdivisionCode: 'BR-MG', country: 'BR' },
  // Pará
  { code: 'BR-BEL', name: 'Belém', subdivisionCode: 'BR-PA', country: 'BR', isCapital: true },
  { code: 'BR-ANA', name: 'Ananindeua', subdivisionCode: 'BR-PA', country: 'BR' },
  { code: 'BR-SNT', name: 'Santarém', subdivisionCode: 'BR-PA', country: 'BR' },
  { code: 'BR-MRB', name: 'Marabá', subdivisionCode: 'BR-PA', country: 'BR' },
  // Paraíba
  { code: 'BR-JPA', name: 'João Pessoa', subdivisionCode: 'BR-PB', country: 'BR', isCapital: true },
  { code: 'BR-CGD', name: 'Campina Grande', subdivisionCode: 'BR-PB', country: 'BR' },
  // Paraná
  { code: 'BR-CWB', name: 'Curitiba', subdivisionCode: 'BR-PR', country: 'BR', isCapital: true },
  { code: 'BR-LDB', name: 'Londrina', subdivisionCode: 'BR-PR', country: 'BR' },
  { code: 'BR-MGA', name: 'Maringá', subdivisionCode: 'BR-PR', country: 'BR' },
  { code: 'BR-PGR', name: 'Ponta Grossa', subdivisionCode: 'BR-PR', country: 'BR' },
  { code: 'BR-CSC', name: 'Cascavel', subdivisionCode: 'BR-PR', country: 'BR' },
  { code: 'BR-FIG', name: 'Foz do Iguaçu', subdivisionCode: 'BR-PR', country: 'BR' },
  // Pernambuco
  { code: 'BR-REC', name: 'Recife', subdivisionCode: 'BR-PE', country: 'BR', isCapital: true },
  { code: 'BR-JBT', name: 'Jaboatão dos Guararapes', subdivisionCode: 'BR-PE', country: 'BR' },
  { code: 'BR-OLD', name: 'Olinda', subdivisionCode: 'BR-PE', country: 'BR' },
  { code: 'BR-CRU', name: 'Caruaru', subdivisionCode: 'BR-PE', country: 'BR' },
  { code: 'BR-PTL', name: 'Petrolina', subdivisionCode: 'BR-PE', country: 'BR' },
  // Piauí
  { code: 'BR-THE', name: 'Teresina', subdivisionCode: 'BR-PI', country: 'BR', isCapital: true },
  { code: 'BR-PRN', name: 'Parnaíba', subdivisionCode: 'BR-PI', country: 'BR' },
  // Rio de Janeiro
  { code: 'BR-GIG', name: 'Rio de Janeiro', subdivisionCode: 'BR-RJ', country: 'BR', isCapital: true },
  { code: 'BR-NTR', name: 'Niterói', subdivisionCode: 'BR-RJ', country: 'BR' },
  { code: 'BR-DQC', name: 'Duque de Caxias', subdivisionCode: 'BR-RJ', country: 'BR' },
  { code: 'BR-SJM', name: 'São João de Meriti', subdivisionCode: 'BR-RJ', country: 'BR' },
  { code: 'BR-NOV', name: 'Nova Iguaçu', subdivisionCode: 'BR-RJ', country: 'BR' },
  { code: 'BR-SGC', name: 'São Gonçalo', subdivisionCode: 'BR-RJ', country: 'BR' },
  { code: 'BR-PTR', name: 'Petrópolis', subdivisionCode: 'BR-RJ', country: 'BR' },
  // Rio Grande do Norte
  { code: 'BR-NAT', name: 'Natal', subdivisionCode: 'BR-RN', country: 'BR', isCapital: true },
  { code: 'BR-MOS', name: 'Mossoró', subdivisionCode: 'BR-RN', country: 'BR' },
  { code: 'BR-PNM', name: 'Parnamirim', subdivisionCode: 'BR-RN', country: 'BR' },
  // Rio Grande do Sul
  { code: 'BR-POA', name: 'Porto Alegre', subdivisionCode: 'BR-RS', country: 'BR', isCapital: true },
  { code: 'BR-CXS', name: 'Caxias do Sul', subdivisionCode: 'BR-RS', country: 'BR' },
  { code: 'BR-PLT', name: 'Pelotas', subdivisionCode: 'BR-RS', country: 'BR' },
  { code: 'BR-CAN', name: 'Canoas', subdivisionCode: 'BR-RS', country: 'BR' },
  { code: 'BR-SMR', name: 'Santa Maria', subdivisionCode: 'BR-RS', country: 'BR' },
  { code: 'BR-GRV', name: 'Gravataí', subdivisionCode: 'BR-RS', country: 'BR' },
  // Rondônia
  { code: 'BR-PVH', name: 'Porto Velho', subdivisionCode: 'BR-RO', country: 'BR', isCapital: true },
  { code: 'BR-JIP', name: 'Ji-Paraná', subdivisionCode: 'BR-RO', country: 'BR' },
  // Roraima
  { code: 'BR-BVB', name: 'Boa Vista', subdivisionCode: 'BR-RR', country: 'BR', isCapital: true },
  // Santa Catarina
  { code: 'BR-FLN', name: 'Florianópolis', subdivisionCode: 'BR-SC', country: 'BR', isCapital: true },
  { code: 'BR-JOI', name: 'Joinville', subdivisionCode: 'BR-SC', country: 'BR' },
  { code: 'BR-BNU', name: 'Blumenau', subdivisionCode: 'BR-SC', country: 'BR' },
  { code: 'BR-ITJ', name: 'Itajaí', subdivisionCode: 'BR-SC', country: 'BR' },
  { code: 'BR-CHA', name: 'Chapecó', subdivisionCode: 'BR-SC', country: 'BR' },
  { code: 'BR-CRC', name: 'Criciúma', subdivisionCode: 'BR-SC', country: 'BR' },
  // São Paulo
  { code: 'BR-GRU', name: 'São Paulo', subdivisionCode: 'BR-SP', country: 'BR', isCapital: true },
  { code: 'BR-CPQ', name: 'Campinas', subdivisionCode: 'BR-SP', country: 'BR' },
  { code: 'BR-GUL', name: 'Guarulhos', subdivisionCode: 'BR-SP', country: 'BR' },
  { code: 'BR-STS', name: 'Santos', subdivisionCode: 'BR-SP', country: 'BR' },
  { code: 'BR-SBC', name: 'São Bernardo do Campo', subdivisionCode: 'BR-SP', country: 'BR' },
  { code: 'BR-SAN', name: 'Santo André', subdivisionCode: 'BR-SP', country: 'BR' },
  { code: 'BR-OSC', name: 'Osasco', subdivisionCode: 'BR-SP', country: 'BR' },
  { code: 'BR-SJC', name: 'São José dos Campos', subdivisionCode: 'BR-SP', country: 'BR' },
  { code: 'BR-RBP', name: 'Ribeirão Preto', subdivisionCode: 'BR-SP', country: 'BR' },
  { code: 'BR-SOR', name: 'Sorocaba', subdivisionCode: 'BR-SP', country: 'BR' },
  // Sergipe
  { code: 'BR-AJU', name: 'Aracaju', subdivisionCode: 'BR-SE', country: 'BR', isCapital: true },
  { code: 'BR-NSD', name: 'Nossa Senhora do Socorro', subdivisionCode: 'BR-SE', country: 'BR' },
  // Tocantins
  { code: 'BR-PMW', name: 'Palmas', subdivisionCode: 'BR-TO', country: 'BR', isCapital: true },
  { code: 'BR-ARG', name: 'Araguaína', subdivisionCode: 'BR-TO', country: 'BR' },
];
