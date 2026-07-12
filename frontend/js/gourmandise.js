/* "Gourmandise" reference data: how many treats the calories burned add up to.
   Products and their calorie equivalents are configured here so they are easy
   to tweak without touching the chart logic. */

const GOURMANDISE = (() => {
  // Kilocalories per unit of each treat.
  const PRODUCTS = [
    { key: "pinte", emoji: "🍺", label: "Pinte", kcal: 220 },
    { key: "pompotes", emoji: "🍎", label: "Pom'Potes", kcal: 50 },
    { key: "pizza", emoji: "🍕", label: "Pizza entière", kcal: 1000 },
    { key: "pates", emoji: "🍝", label: "Assiette de pâtes", kcal: 600 },
    { key: "chocolat", emoji: "🍫", label: "Tablette de chocolat", kcal: 1100 },
  ];

  // Rough approximation: calories burned ≈ weight (kg) × distance (km).
  const caloriesBurned = (weightKg, distanceKm) => weightKg * distanceKm;

  const findProduct = (key) =>
    PRODUCTS.find((product) => product.key === key) || PRODUCTS[0];

  return { PRODUCTS, caloriesBurned, findProduct };
})();
