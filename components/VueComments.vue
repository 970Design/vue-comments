<script setup>
import {ref, onMounted, computed, watch, nextTick} from 'vue';
import { load } from 'recaptcha-v3';

const props = defineProps({
  post_id: {
    type: [String, Number],
    required: true
  },
  endpoint: {
    type: String,
    required: true
  },
  api_key: {
    type: String,
    required: true
  },
  order: {
    type: String,
    default: 'DESC',
    validator: (value) => ['ASC', 'DESC'].includes(value.toUpperCase())
  }
});

const commentsData = ref(null);
const loading = ref(true);
const submitting = ref(false);
const message = ref('');
const replyingTo = ref(null);
const recaptchaConfig = ref({ enabled: false, site_key: '' });
const recaptchaInstance = ref(null);

// Fetch reCAPTCHA configuration
const fetchRecaptchaConfig = async () => {
  try {
    const response = await fetch(
        `${props.endpoint}/wp-json/headless-comments/v1/recaptcha/config`,
        {
          headers: {
            'X-API-Key': props.api_key
          }
        }
    );

    if (response.ok) {
      const config = await response.json();
      recaptchaConfig.value = config;

      // Load reCAPTCHA v3 if enabled
      if (config.enabled && config.site_key) {
        try {
          recaptchaInstance.value = await load(config.site_key);
        } catch (error) {
          console.error('Error loading reCAPTCHA:', error);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching reCAPTCHA config:', error);
  }
};

// Get reCAPTCHA token
const getRecaptchaToken = async () => {
  if (!recaptchaConfig.value.enabled || !recaptchaInstance.value) {
    return null;
  }

  try {
    const token = await recaptchaInstance.value.execute('submit_comment');

    return token;
  } catch (error) {
    console.error('Error getting reCAPTCHA token:', error);
    return null;
  }
};

// Fetch comments using the headless comments API
const fetchComments = async () => {
  loading.value = true;
  try {
    const orderParam = props.order ? props.order.toUpperCase() : 'DESC';
    const response = await fetch(
        `${props.endpoint}/wp-json/headless-comments/v1/posts/${props.post_id}/comments?order=${orderParam}`,
        {
          headers: {
            'X-API-Key': props.api_key
          }
        }
    );

    if (response.ok) {
      commentsData.value = await response.json();
    } else {
      console.error('Failed to fetch comments:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Error fetching comments:', error);
  } finally {
    loading.value = false;
  }
};

// Computed property for comment count
const commentCount = computed(() => {
  return commentsData.value?.count || 0;
});

// Computed property for rendered HTML
const renderedComments = computed(() => {
  return commentsData.value?.rendered || '';
});

// Submit comment using the headless comments API
const submitComment = async (event) => {
  event.preventDefault();
  submitting.value = true;
  message.value = '';

  const formData = new FormData(event.target);
  const commentData = {
    author_name: formData.get('author_name'),
    author_email: formData.get('author_email'),
    content: formData.get('content'),
    parent: formData.get('comment_parent') || 0
  };

  try {
    // Get reCAPTCHA token if enabled
    if (recaptchaConfig.value.enabled) {
      const token = await getRecaptchaToken();

      if (token) {
        commentData.recaptcha_token = token;
      } else {
        message.value = 'Failed to verify reCAPTCHA. Please try again.';
        submitting.value = false;
        return;
      }
    }

    const response = await fetch(
        `${props.endpoint}/wp-json/headless-comments/v1/posts/${props.post_id}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': props.api_key
          },
          body: JSON.stringify(commentData)
        }
    );

    if (response.ok) {
      const result = await response.json();
      message.value = result.message || 'Comment submitted successfully!';
      event.target.reset();

      // Clear reply state
      replyingTo.value = null;

      // Refresh comments if auto-approved
      if (result.approved) {
        await fetchComments();
      }
    } else {
      const error = await response.json();
      message.value = error.message || 'Error submitting comment. Please try again.';
    }
  } catch (error) {
    message.value = 'Error submitting comment. Please try again.';
    console.error('Submit error:', error);
  } finally {
    submitting.value = false;
  }
};

// Handle reply button click
const handleReplyClick = (event) => {
  event.preventDefault();
  const commentId = event.target.getAttribute('data-commentid');
  const replyToText = event.target.getAttribute('data-replyto');

  if (commentId) {
    replyingTo.value = {
      id: commentId,
      replyTo: replyToText || `Comment #${commentId}`
    };

    // Scroll to form
    setTimeout(() => {
      const formElement = document.getElementById('respond');
      if (formElement) {
        formElement.scrollIntoView({behavior: 'smooth', block: 'start'});
        // Focus on the comment textarea
        const textarea = formElement.querySelector('#comment');
        if (textarea) {
          textarea.focus();
        }
      }
    }, 100);
  }
};

// Cancel reply
const cancelReply = () => {
  replyingTo.value = null;
};

// Attach event listeners to reply links
const attachReplyListeners = () => {
  nextTick(() => {
    const replyLinks = document.querySelectorAll('.comment-reply-link');
    replyLinks.forEach(link => {
      // Remove existing listener if any
      link.removeEventListener('click', handleReplyClick);
      // Add new listener
      link.addEventListener('click', handleReplyClick);
    });
  });
};

// Watch for changes in rendered comments
watch(renderedComments, () => {
  attachReplyListeners();
});

onMounted(async () => {
  await fetchRecaptchaConfig();
  await fetchComments();
});
</script>

<template>
  <section class="comments-area">
    <h3 v-if="commentCount > 0">{{ commentCount }} {{ commentCount === 1 ? 'Comment' : 'Comments' }}</h3>
    <h3 v-else>Comments</h3>

    <!-- Loading State -->
    <div v-if="loading" class="loading">Loading comments...</div>

    <!-- Comments List -->
    <div v-else-if="renderedComments" class="comments-list">
      <ol class="comment-list" v-html="renderedComments"></ol>
    </div>

    <!-- No Comments -->
    <div v-else class="no-comments">
      <p>No comments yet. Be the first to comment!</p>
    </div>

    <!-- Comment Form -->
    <div id="respond" class="comment-respond">
      <h3 id="reply-title" class="comment-reply-title">
        <span v-if="replyingTo">{{ replyingTo.replyTo }}</span>
        <span v-else>Leave a Comment</span>
        <small v-if="replyingTo">
          <a rel="nofollow" @click.prevent="cancelReply" style="cursor: pointer;">Cancel reply</a>
        </small>
      </h3>

      <div v-if="message" class="message" :class="{ success: message.includes('successfully'), error: !message.includes('successfully') }">
        {{ message }}
      </div>

      <form id="commentform" class="comment-form" @submit="submitComment">
        <input type="hidden" name="comment_post_ID" :value="props.post_id">
        <input type="hidden" name="comment_parent" :value="replyingTo?.id || 0">

        <p class="comment-form-author">
          <label for="author">Name <span class="required">*</span></label>
          <input id="author" name="author_name" type="text" required>
        </p>

        <p class="comment-form-email">
          <label for="email">Email <span class="required">*</span></label>
          <input id="email" name="author_email" type="email" required>
        </p>

        <p class="comment-form-comment">
          <label for="comment">Comment <span class="required">*</span></label>
          <textarea id="comment" name="content" rows="8" required></textarea>
        </p>

        <p class="form-submit">
          <button type="submit" :disabled="submitting" id="submit" class="btn submit">
            {{ submitting ? 'Submitting...' : 'Submit Comment' }}
          </button>
        </p>
      </form>
    </div>
  </section>
</template>

<style scoped>
.comments-area {
  margin: 3rem 0;
  padding: 2rem 0;
  border-top: 1px solid #eee;
}

.loading {
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 2rem 0;
}

.comment-list {
  list-style: none;
  padding: 0;
  margin: 2rem 0;
}

.comment-list :deep(li) {
  margin: 0 0 1.5rem 0;
}

.comment-list :deep(.children) {
  list-style: none;
  padding: 0;
  margin-left: 2rem;
  margin-top: 1.5rem;
}

@media (max-width: 768px) {
  .comment-list :deep(.children) {
    margin-left: 1rem;
  }
}

.comment-list :deep(.comment-body) {
  padding: 1.5rem;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.comment-list :deep(.comment-meta) {
  margin-bottom: 1rem;
}

.comment-list :deep(.comment-author) {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.comment-list :deep(.comment-author img) {
  border-radius: 50%;
  width: 48px;
  height: 48px;
}

.comment-list :deep(.comment-author .fn) {
  font-weight: 600;
  color: #333;
  font-size: 1.1rem;
}

.comment-list :deep(.comment-author .says) {
  color: #666;
  font-weight: normal;
  font-size: 0.9rem;
}

.comment-list :deep(.comment-metadata) {
  font-size: 0.85rem;
  color: #666;
}

.comment-list :deep(.comment-metadata a) {
  color: inherit;
  text-decoration: none;
}

.comment-list :deep(.comment-metadata a:hover) {
  color: #0066cc;
}

.comment-list :deep(.edit-link) {
  margin-left: 0.5rem;
}

.comment-list :deep(.edit-link a) {
  color: #0066cc;
}

.comment-list :deep(.comment-awaiting-moderation) {
  padding: 0.5rem 1rem;
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  color: #856404;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.comment-list :deep(.comment-content) {
  margin: 1rem 0;
  line-height: 1.6;
  color: #333;
}

.comment-list :deep(.comment-content p) {
  margin: 0.5rem 0;
}

.comment-list :deep(.reply) {
  margin-top: 0.75rem;
}

.comment-list :deep(.comment-reply-link) {
  display: inline-block;
  padding: 0.4rem 1rem;
  background-color: #0066cc;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: background 0.2s;
  cursor: pointer;
}

.comment-list :deep(.comment-reply-link:hover) {
  background-color: #0052a3;
}

.no-comments {
  text-align: center;
  color: #666;
  font-style: italic;
  margin: 2rem 0;
  padding: 2rem;
}

.comment-respond {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #eee;
}

.comment-reply-title {
  margin-bottom: 1.5rem;
  color: #333;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.comment-reply-title small {
  font-size: 0.7em;
  font-weight: normal;
}

.comment-reply-title small a {
  color: #0066cc;
  text-decoration: none;
}

.comment-reply-title small a:hover {
  text-decoration: underline;
}

.comment-form-author,
.comment-form-email,
.comment-form-comment {
  margin: 1rem 0;
}

.comment-form-author label,
.comment-form-email label,
.comment-form-comment label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.comment-form-author .required,
.comment-form-email .required,
.comment-form-comment .required {
  color: #dc3545;
}

.comment-form-author input,
.comment-form-email input,
.comment-form-comment textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
}

.comment-form-author input:focus,
.comment-form-email input:focus,
.comment-form-comment textarea:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.form-submit {
  margin: 1.5rem 0 0;
}

.submit {
  background-color: #0066cc;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.submit:hover:not(:disabled) {
  background-color: #0052a3;
}

.submit:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.comment-notes,
.message {
  border-radius: 4px;
  padding: 1rem;
  margin: 1rem 0;
}

.comment-notes {
  background-color: #f3f3f3;
  border: 1px solid #eee;
}

.message.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}
</style>
