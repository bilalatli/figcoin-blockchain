/*
const BLOCKCHAIN_CHUNK_SIZE = 1000;

const getBlockGroupIndex = (blockIndex: number) => {
  return (Math.floor(blockIndex / BLOCKCHAIN_CHUNK_SIZE) + 1) * BLOCKCHAIN_CHUNK_SIZE;
};

function test(offset = 75, page = 10) {
  const lastBlockIndex = 3755;
  const startIndex = 999;

  const offsetBlock = getBlockGroupIndex(startIndex);
  console.log('Offset Block: ', offsetBlock);

  const virtualStartIndex = startIndex - (Math.floor(startIndex / BLOCKCHAIN_CHUNK_SIZE) * BLOCKCHAIN_CHUNK_SIZE);
  const virtualEndIndex = virtualStartIndex + page;
  console.log('Virtual Indexes: ', virtualStartIndex, virtualEndIndex);

  return true;
}

test();
*/
