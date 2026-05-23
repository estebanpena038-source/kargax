# 94 - Capital And Partner Pipeline

## Estado

- artifact status: `completed`
- repo integration status: `completed`
- partner execution status: `tracked inside this document`
- cierre: este archivo queda cerrado como pipeline oficial de capital y partners

## Proposito

La capa financiera no escala solo con codigo. Este pipeline define el minimo para lanzar `CO` y lo que sigue bloqueado para `PE/EC`.

## Regla de launch

- `CO`: puede abrir solo con rails, counsel y fallback definidos.
- `PE/EC`: pueden quedar backend-ready pero `not open` hasta cerrar partners y compliance reales.

## Pipeline vivo

| Partner type | Country | Estado | Owner | Next step | Fallback | Commercial or legal blocker | Target date |
|---|---|---|---|---|---|---|---|
| payment processor | CO | active_required | Finance Lead | validar contrato, webhook firmado y fallback operativo | processor alterno o manual reconcile controlado | sin processor activo no hay launch financiero | antes de launch |
| payout rail | CO | active_required | Finance Lead | validar retiros productivos y tiempos de settlement | payout manual controlado de emergencia | sin rail confiable no se abre wallet productiva | antes de launch |
| legal/compliance | CO | active_required | CEO / Founder | counsel revisa TOS, privacidad y rails financieros | counsel externo temporal | sin mapa legal no se escala dinero | antes de launch |
| capital provider | CO | controlled_required | CEO / Founder | definir capital propio o linea controlada para advances | libro pausado | sin vehiculo definido no se expande lending | antes de escalar adelantos |
| identity / KYB / KYC | CO | controlled_optional | Head of Ops | definir minimo operativo por actor | proceso manual controlado | bloquea escalado enterprise regulado | 30 dias |
| collections | CO | controlled_optional | Finance Lead | definir politica y operador de cobranza | cobranza interna | bloquea crecimiento del libro | 30 dias |
| insurance | CO | conditional | Head of Ops | activar solo si cliente o lane lo exige | sin producto asegurado | no bloquea launch general | cuando aplique |
| payment processor | PE | not_open | Country Launch Lead | shortlist y due diligence | flag cerrado | sin partner y compliance, mercado cerrado | no comprometer fecha |
| payout rail | PE | not_open | Country Launch Lead | shortlist y due diligence | flag cerrado | sin payouts confiables, mercado cerrado | no comprometer fecha |
| legal/compliance | PE | not_open | CEO / Founder | counsel local y requisitos fiscales | flag cerrado | sin counsel local, mercado cerrado | no comprometer fecha |
| payment processor | EC | not_open | Country Launch Lead | shortlist y due diligence | flag cerrado | sin partner y compliance, mercado cerrado | no comprometer fecha |
| payout rail | EC | not_open | Country Launch Lead | shortlist y due diligence | flag cerrado | sin payouts confiables, mercado cerrado | no comprometer fecha |
| legal/compliance | EC | not_open | CEO / Founder | counsel local y requisitos fiscales | flag cerrado | sin counsel local, mercado cerrado | no comprometer fecha |

## Criterios para sumar capital externo

- datos reales de uso
- comportamiento de repayment observable
- economics por cliente entendibles
- control operativo y legal suficiente

## Criterios para NO sumar partner aun

- el producto no se puede recorrer de forma limpia
- no existe disciplina de settlement
- el libro de adelantos no tiene trazabilidad
- el partnership agrega complejidad antes de necesidad real

## Integracion con riesgos

- cualquier partner critico sin fallback abre riesgo rojo en `92`
- cualquier mercado sin compliance real permanece `not open`
- cualquier promesa comercial sobre `PE/EC` debe respetar feature flags y readiness real
