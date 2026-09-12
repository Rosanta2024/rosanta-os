// Rosanta · Design System — showcase. Feeds Claude Design the brand's look & components.
import React from 'react';
import { colors } from './tokens';
import { Hero, Title, Eyebrow, Body } from './components/Typography';
import Swatches from './components/Swatches';
import Logo from './components/Logo';
import Flor from './components/Flor';
import Card from './components/Card';
import Pill from './components/Pill';
import Button from './components/Button';
import Statement from './components/Statement';

const Section = ({ label, children }) => (
  <section style={{ margin: '0 0 40px' }}>
    <Eyebrow>{label}</Eyebrow>
    <div style={{ marginTop: 12 }}>{children}</div>
  </section>
);

export default function App() {
  return (
    <div style={{ background: colors.crema, minHeight: '100vh', padding: 48, fontFamily: 'Avenir, Lato, sans-serif' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <Logo variant="verde" width={200} />
        <div style={{ margin: '18px 0 40px' }}>
          <Eyebrow>La Segunda Cosecha</Eyebrow>
          <Hero>Cocina<br/>con Carisma</Hero>
        </div>

        <Section label="01 · Color"><Swatches /></Section>

        <Section label="02 · Tipografía">
          <Title flourish="comer bien">No necesitas arreglarte para</Title>
          <Body>Peskia solo en títulos hero (mayúsculas, grande). Playfair para el resto de títulos.
            Avenir (o Lato) para el cuerpo. Poppins para eyebrows y etiquetas. El gesto firma es el
            remate en verde medio itálica.</Body>
        </Section>

        <Section label="03 · La flor">
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
            <Flor kind="botanica" width={150} />
            <Flor kind="grande" fill="verde" width={150} />
          </div>
        </Section>

        <Section label="04 · Componentes">
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <Button variant="primary">Reservar</Button>
            <Button variant="ghost">Ver la carta</Button>
            <Pill>Fresco</Pill><Pill tone="lila">Fuego</Pill>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}><Card title="El propósito" tone="light">Celebrar la abundancia natural de Guatemala con cocina viva y hospitalidad consciente.</Card></div>
            <div style={{ flex: 1 }}><Card title="El filo" tone="green">Comes increíble sin arreglarte. La mejor mesa es la sobremesa.</Card></div>
          </div>
        </Section>

        <Section label="05 · Statement (pieza estrella)">
          <Statement
            eyebrow="Ven como eres"
            headline="No necesitas arreglarte para"
            flourish="comer bien."
            body="Aquí venís como sos, te sentás en el jardín y te quedás hasta la sobremesa."
          />
        </Section>
      </div>
    </div>
  );
}
