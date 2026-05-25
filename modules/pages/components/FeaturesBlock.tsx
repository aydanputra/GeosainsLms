"use client";

interface Feature {
  title: string;
  description: string;
  icon?: string;
}

interface FeaturesBlockProps {
  content: {
    heading?: string;
    features: Feature[];
  };
}

export default function FeaturesBlock({ content }: FeaturesBlockProps) {
  return (
    <div className="bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {content.heading && (
          <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-12">
            {content.heading}
          </h2>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {content.features?.map((feature, index) => (
            <div key={index} className="bg-white p-6 rounded-lg shadow-sm text-center">
              <div className="text-indigo-600 mb-4 text-4xl">{feature.icon || '★'}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
