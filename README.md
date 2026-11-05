# ALPS Device Console

Take-home exercise. Design decisions are in [NOTES.md](NOTES.md).

```bash
npm install
npm run dev     # API is mocked in the browser by MSW
npm test
npm run build
npm run lint
```

```
src/
  data/                  data layer: transport, cache, useQuery, useMutation, tenant hooks
  api/operations.ts      operations from Appendix B, types, query keys
  features/              device list, detail panel, lock action
  mocks/                 Appendix A
```
