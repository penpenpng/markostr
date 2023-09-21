<script lang="ts">
  import MarkovChain from "@hideokamoto/markov-chain-tiny";
  import { NostrFetcher } from "nostr-fetch";
  import { nip19 } from "nostr-tools";
  import { update, get } from "./storage";
  import type * as Nostr from "nostr-typedef";

  const store = get();
  const relay = "wss://yabu.me";
  const hashtag = "markostr";
  const here = window.location.href;
  const likeUrl = /[a-zA-Z]+:\/\/\S*/g;
  const likeBech = /(note1|npub1|nprofile1|nevent1)\w*/g;
  const likeCustomEmoji = /:\w+:/g;

  // @ts-ignore
  MarkovChain.prototype.makeDic = function (data) {
    // @ts-ignore
    const morphemes = this.nonoise(data);
    const lines = morphemes.split("。");
    const morpheme = Object.create(null);
    for (const line of lines) {
      // @ts-ignore
      const words = this.segmenter.segment(line);
      if (!morpheme["_BOS_"]) {
        morpheme["_BOS_"] = [];
      }
      if (words[0]) {
        morpheme["_BOS_"].push(words[0]);
      }
      for (const [index, word] of words.entries()) {
        const nextWord = words[index + 1] ?? "_EOS_";
        if (!morpheme[word]) {
          morpheme[word] = [];
        }
        morpheme[word].push(nextWord);
        if (word === "、") {
          morpheme["_BOS_"].push(nextWord);
        }
      }
    }
    return morpheme;
  };

  let npub = store.npub ?? "";
  let fetchedCount = 0;
  let output = "";
  let markov: MarkovChain | null = null;
  let generatingModel = Promise.resolve();

  const fetcher = NostrFetcher.init();

  const getPubkey = (): string => {
    const { type, data } = nip19.decode(npub);

    if (type !== "npub") {
      throw new Error();
    }

    return data;
  };

  const purify = (content: string): string => {
    return (
      content
        .replace(likeUrl, "")
        .replace(likeBech, "")
        .replace(likeCustomEmoji, "")
        .trim() + "\n"
    );
  };

  const generateModel = async () => {
    update({ npub });

    let pubkey = "";
    try {
      pubkey = getPubkey();
    } catch {
      throw new Error("公開鍵のパースに失敗しました");
    }

    fetchedCount = 0;

    let input = "";
    const iter = fetcher.allEventsIterator(
      [relay],
      { kinds: [1], authors: [pubkey] },
      {}
    );
    for await (const { content, tags } of iter) {
      if (tags.find((e) => e[0] === "t" && e[1] === hashtag)) {
        continue;
      }

      fetchedCount = fetchedCount + 1;
      input += purify(content);
    }

    update({ trainingData: input, trainingDataSize: fetchedCount });
    markov = new MarkovChain(input);
  };

  const loadModel = async () => {
    fetchedCount = store.trainingDataSize ?? NaN;
    markov = new MarkovChain(store.trainingData ?? "");
  };

  const generateSentence = () => {
    output = (markov?.makeSentence() ?? "").trim();
  };

  const canPost = () => {
    return !!output && !!(window as any).nostr;
  };

  const getContent = () => `${output}\n${here} #${hashtag}`;

  const copyContent = async () => {
    try {
      navigator.clipboard.writeText(getContent());
    } catch {}
  };

  const postResult = async () => {
    const nostr: Nostr.Nip07.Nostr = (window as any).nostr;

    const event = await nostr.signEvent({
      kind: 1,
      content: getContent(),
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["t", hashtag],
        ["r", here],
      ],
    });
    if (!event) {
      return;
    }
    const timeoutDuration = 2000;
    const ws = new WebSocket(relay);
    ws.onopen = () => {
      ws.send(
        JSON.stringify(["EVENT", event] satisfies Nostr.ToRelayMessage.EVENT)
      );
    };
    ws.onmessage = (e) => {
      ws.close();
    };
    setTimeout(() => {
      ws.close();
    }, timeoutDuration);
  };
</script>

<main>
  <h1>Markostr</h1>

  <div class="input">
    <label for="npub">公開鍵:</label>
    <input id="npub" type="text" bind:value={npub} placeholder="npub1..." />
  </div>

  <div class="action">
    <button
      on:click={async () => {
        generatingModel = generateModel();
      }}>マルコフモデルを生成</button
    >
    {#if store.trainingData}
      <button
        on:click={async () => {
          generatingModel = loadModel();
        }}>前回のマルコフモデルをロード</button
      >
    {/if}
  </div>

  {#await generatingModel}
    <div class="progress">投稿を取得中…… {fetchedCount}</div>
  {:then}
    {#if markov}
      <hr />
      <div>
        {fetchedCount}件の投稿からマルコフモデルを生成しました。文章を生成できます。
      </div>
      <button class="action" on:click={generateSentence}>文章を生成</button>
    {/if}

    {#if output}
      <div class="output">
        {output}
      </div>
      <div class="action">
        <button on:click={copyContent}>コピー</button>
        <button on:click={postResult} disabled={!canPost()}
          >投稿 (要NIP-07)</button
        >
      </div>
    {/if}
  {:catch error}
    <div class="error">エラーが発生しました: {error.message}</div>
  {/await}
</main>

<style>
  main {
    width: 100%;
    max-width: 480px;
  }

  hr {
    margin: 20px 0;
  }

  button {
    margin: 4px 0;
  }

  .action {
    margin-top: 10px;
    margin-bottom: 20px;
  }

  .output {
    border: solid 1px #ccc;
    border-radius: 8px;
    padding: 20px;
    white-space: pre-line;
    word-break: break-all;
  }
</style>
