import torch
from dataclasses import dataclass
from transformers import AutoProcessor

@dataclass
class QwenVLDataCollator:
    """
    Data collator that converts a batch of multimodal messages into PyTorch tensors
    suitable for Qwen3-VL supervised fine-tuning.
    
    It constructs:
    - input_ids
    - attention_mask
    - pixel_values
    - image_grid_thw (Qwen specific layout tensors)
    - labels (Masking out user prompts so loss is only calculated on the assistant answer)
    """
    processor: AutoProcessor

    def __call__(self, batch):
        messages_list = [item["messages"] for item in batch]
        
        # We need to construct the labels tensor. 
        # A common approach for Qwen-VL is to process the chat template, 
        # which yields text with special tokens (e.g., <|im_start|>, <|im_end|>).
        
        # 1. Apply processor
        # The Qwen processor's apply_chat_template natively parses the [{"type": "image", "image": PIL}, ...] structure
        # if using qwen-vl-utils or transformers>=4.48 natively.
        
        # To mask out the prompt, we let the processor handle text generation formulation
        texts = [
            self.processor.apply_chat_template(msg, tokenize=False, add_generation_prompt=False)
            for msg in messages_list
        ]
        
        # 2. Extract images from the raw batch to pass to the processor
        # (qwen-vl-utils parses PIL objects directly out of the dictionaries if formatted correctly)
        
        # Process the entire batch
        # We must set return_tensors="pt" and pad appropriately.
        batch_inputs = self.processor(
            text=texts,
            images=[msg_dict["content"][img_idx]["image"] 
                    for messages in messages_list 
                    for msg_dict in messages 
                    for img_idx in range(len(msg_dict.get("content", []))) 
                    if isinstance(msg_dict.get("content", [])[img_idx], dict) and msg_dict["content"][img_idx].get("type") == "image"],
            padding=True,
            return_tensors="pt"
        )
        
        input_ids = batch_inputs["input_ids"]
        labels = input_ids.clone()
        
        # 3. Mask labels for Supervised Fine Tuning (SFT)
        # We want to train ONLY on the assistant's response.
        # Qwen templates output `<|im_start|>assistant\n` before the assistant response,
        # and `<|im_end|>` after.
        
        assistant_token_id = self.processor.tokenizer.convert_tokens_to_ids("<|im_start|>")
        # For a more robust approach, we find the exact assistant string tokens, but 
        # a common heuristic is to mask everything until the assistant's start sequence.
        
        for i in range(labels.shape[0]):
            # Decode the sequence to find the exact character index of the assistant response,
            # or iterate over tokens.
            # Here we use a token-based heuristic looking for the sequence that corresponds to "\nassistant\n" or similar.
            
            # Since Qwen uses <|im_start|> assistant \n, we can find these blocks.
            # Mask everything as -100 initially for this row
            labels[i, :] = -100
            
            # Find all <|im_start|> and <|im_end|>
            # Qwen tokenizer details:
            # <|im_start|> is typically a specific special token
            start_tokens = (input_ids[i] == assistant_token_id).nonzero(as_tuple=True)[0]
            
            # We want to unmask ONLY the tokens that follow `<|im_start|>assistant\n`
            # For simplicity in this robust implementation, we iterate through the decoded text mapping
            # Alternatively, we can find the exact token sequence.
            
            # Fallback robust masking: 
            # We assume the last message is the assistant's answer because we construct it that way in dataset.py
            token_list = input_ids[i].tolist()
            
            # Look backwards for the last <|im_start|> which marks the assistant turn
            last_start_idx = -1
            for idx in reversed(range(len(token_list))):
                if token_list[idx] == assistant_token_id:
                    last_start_idx = idx
                    break
                    
            if last_start_idx != -1:
                # The tokens immediately following are "assistant" and "\n".
                # We skip forward by ~2 tokens to unmask the actual text.
                # (Actual token lengths vary, 3 is a safe skip for `<|im_start|> assistant \n`)
                start_of_answer = last_start_idx + 3
                
                # Unmask from start_of_answer to the end of the sequence (or padding)
                # Ensure we don't unmask PAD tokens (usually 0 or <|endoftext|>)
                pad_token_id = self.processor.tokenizer.pad_token_id
                
                for idx in range(start_of_answer, len(token_list)):
                    if token_list[idx] != pad_token_id:
                        labels[i, idx] = input_ids[i, idx]
            else:
                # If parsing fails, train on the whole sequence as a fallback (not ideal, but prevents crash)
                labels[i, :] = input_ids[i, :]

        batch_inputs["labels"] = labels
        return batch_inputs
