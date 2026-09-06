import fs from 'node:fs';
const source = JSON.parse(
  fs.readFileSync('outputs/world-countries-source.geojson', 'utf8'),
);
const countries = source.features
  .filter((f) => f.properties.ISO_A3 !== 'ATA')
  .map((f) => {
    const p = f.properties,
      polygons =
        f.geometry.type === 'Polygon'
          ? [f.geometry.coordinates]
          : f.geometry.coordinates;
    const path = polygons
      .flatMap((poly) =>
        poly.map(
          (ring) =>
            ring
              .map(
                ([lon, lat], i) =>
                  (i ? 'L' : 'M') +
                  ((lon + 180) * 2.5).toFixed(2) +
                  ',' +
                  ((90 - lat) * 2.5).toFixed(2),
              )
              .join('') + 'Z',
        ),
      )
      .join('');
    const code =
      p.ADM0_A3 === 'KOS'
        ? 'XK'
        : p.ISO_A2_EH === '-99'
          ? p.ADM0_A3
          : p.ISO_A2_EH;
    return {
      code,
      name: p.NAME_EN || p.NAME_LONG,
      aliases: [
        p.ISO_A3_EH,
        p.ADMIN,
        p.NAME_LONG,
        p.NAME,
        p.WB_A2,
        p.ADM0_A3,
      ].filter((value) => value && value !== '-99'),
      x: Number(((p.LABEL_X + 180) * 2.5).toFixed(2)),
      y: Number(((90 - p.LABEL_Y) * 2.5).toFixed(2)),
      path,
    };
  });
fs.writeFileSync('public/maps/world-countries.json', JSON.stringify(countries));
fs.writeFileSync(
  'public/maps/credits.txt',
  'Natural Earth 1:110m Admin 0 countries, public domain.\nhttps://www.naturalearthdata.com/about/terms-of-use/\nSource: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson\nEquirectangular projection; coordinates rounded to 0.01 viewBox units. Antarctica omitted. Borders are for statistical navigation.\n',
);
console.log({
  countries: countries.length,
  bytes: fs.statSync('public/maps/world-countries.json').size,
  kosovo: countries.some((c) => c.code === 'XK'),
});
