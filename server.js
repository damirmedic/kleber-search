const express = require('express');
const axios = require('axios');
const cors = require('cors'); // Import the CORS package
const app = express();
const PORT = process.env.PORT || 3000;

const STOREFRONT_ACCESS_TOKEN = 'ee4cf0f74f6afbca05b640c4a98e35be';
const GRAPHQL_URL = 'https://cded2c-d8.myshopify.com/api/2024-04/graphql.json';

// Use CORS middleware
app.use(
  cors({
    origin: 'https://www.bueroaufloesung.ch', // Allow only this origin
  })
);

app.use(express.json());
app.use(express.static('public')); // Serve static files from the "public" directory

async function fetchAllProducts(after = null) {
  const query = `
      query ($after: String) {
        products(first: 250, after: $after) {
          edges {
            cursor
            node {
                title
                onlineStoreUrl
                featuredImage {
                    originalSrc
                }
                priceRange {
                    minVariantPrice {
                    amount
                    currencyCode
                    }
                }
                metafield(namespace: "custom", key: "kleber_nr_") {
                    value
              }
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `;

  const variables = { after };

  try {
    const response = await axios.post(
      GRAPHQL_URL,
      { query, variables },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESS_TOKEN,
        },
      }
    );

    return response.data.data.products;
  } catch (error) {
    console.error('Error fetching products:', error.response ? error.response.data : error.message);
    throw new Error('Error fetching products');
  }
}

app.post('/graphql', async (req, res) => {
  try {
    const { kleberNrValue } = req.body;
    let after = null;
    let hasNextPage = true;
    let allProducts = [];

    while (hasNextPage) {
      const products = await fetchAllProducts(after);
      allProducts = allProducts.concat(products.edges.map((edge) => edge.node));
      hasNextPage = products.pageInfo.hasNextPage;
      if (hasNextPage) {
        after = products.edges[products.edges.length - 1].cursor;
      }
    }

    const matchedProduct = allProducts.find((product) => {
      if (product.metafield && product.metafield.value) {
        const metafieldArray = JSON.parse(product.metafield.value);
        return metafieldArray.includes(kleberNrValue);
      }
      return false;
    });

    if (matchedProduct) {
      res.json(matchedProduct);
    } else {
      res.status(404).send('Product not found');
    }
  } catch (error) {
    res.status(500).send('Server error');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
